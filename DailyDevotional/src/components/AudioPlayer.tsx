import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Easing,
    ActivityIndicator,
} from 'react-native';
import * as Speech from 'expo-speech';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, TouchTarget } from '../constants/theme';
import { Devotional } from '../types';
import { useSettingsStore } from '../store/settingsStore';

interface AudioPlayerProps {
    devotional: Devotional;
    darkMode: boolean;
    compact?: boolean;
}

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
type SpeedOption = 0.75 | 1 | 1.25 | 1.5;

const SPEED_OPTIONS: SpeedOption[] = [0.75, 1, 1.25, 1.5];

// Deterministic waveform profile (no Math.random())
const WAVE_BASE_HEIGHTS = [10, 18, 13, 22, 15, 20, 12];
const WAVE_PHASE_FACTORS = [0.65, 1.0, 0.8, 0.95, 0.7, 0.9, 0.6];

function formatDuration(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function AudioPlayer({ devotional, darkMode, compact = false }: AudioPlayerProps) {
    const colors = darkMode ? Colors.dark : Colors.light;
    const reducedMotion = useSettingsStore((s) => s.reducedMotion);

    const hasRemoteAudio = Boolean(devotional.audioUrl && devotional.audioUrl.trim().length > 0);
    const player = useAudioPlayer(hasRemoteAudio ? { uri: devotional.audioUrl! } : null);
    const playerStatus = useAudioPlayerStatus(player);

    // Speech (TTS fallback) chunked by paragraph so pause/resume and progress work deterministically
    const speechChunks = useMemo(() => {
        const chunks: { label: string; text: string }[] = [
            { label: 'Title & Scripture', text: `${devotional.title}. Scripture reading from ${devotional.scriptureReference}. ${devotional.scriptureText}` },
        ];
        const paragraphs = devotional.body
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean);
        paragraphs.forEach((p, idx) => {
            chunks.push({
                label: `Reading (${idx + 1}/${paragraphs.length})`,
                text: p,
            });
        });
        if (devotional.prayer) {
            chunks.push({
                label: 'Closing Prayer',
                text: `Closing prayer. ${devotional.prayer}`,
            });
        }
        return chunks;
    }, [devotional]);

    const [ttsState, setTtsState] = useState<PlaybackState>('idle');
    const [ttsChunkIndex, setTtsChunkIndex] = useState(0);
    const [speed, setSpeed] = useState<SpeedOption>(1);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const ttsStateRef = useRef<PlaybackState>('idle');
    ttsStateRef.current = ttsState;
    const speedRef = useRef<SpeedOption>(1);
    speedRef.current = speed;

    // Deterministic phase animation for waveform bars
    const waveAnim = useRef(new Animated.Value(0)).current;

    const effectiveState: PlaybackState = useMemo(() => {
        if (errorMessage) return 'error';
        if (hasRemoteAudio) {
            if (!playerStatus.isLoaded && playerStatus.isBuffering) return 'loading';
            if (playerStatus.playing) return 'playing';
            if (playerStatus.currentTime > 0 && !playerStatus.didJustFinish) return 'paused';
            return 'idle';
        }
        return ttsState;
    }, [errorMessage, hasRemoteAudio, playerStatus, ttsState]);

    useEffect(() => {
        if (effectiveState === 'playing' && !reducedMotion) {
            const loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(waveAnim, {
                        toValue: 1,
                        duration: 650,
                        easing: Easing.inOut(Easing.sin),
                        useNativeDriver: false,
                    }),
                    Animated.timing(waveAnim, {
                        toValue: 0,
                        duration: 650,
                        easing: Easing.inOut(Easing.sin),
                        useNativeDriver: false,
                    }),
                ])
            );
            loop.start();
            return () => loop.stop();
        } else {
            waveAnim.setValue(0);
        }
    }, [effectiveState, reducedMotion, waveAnim]);

    // Clean up TTS when devotional changes or unmounts
    useEffect(() => {
        return () => {
            Speech.stop();
        };
    }, [devotional.id]);

    const speakChunk = useCallback(
        (index: number, rate: SpeedOption) => {
            if (index >= speechChunks.length) {
                setTtsState('idle');
                setTtsChunkIndex(0);
                return;
            }
            setTtsChunkIndex(index);
            setTtsState('playing');
            setErrorMessage(null);

            Speech.speak(speechChunks[index].text, {
                rate,
                onDone: () => {
                    if (ttsStateRef.current === 'playing') {
                        speakChunk(index + 1, speedRef.current);
                    }
                },
                onError: () => {
                    setTtsState('error');
                    setErrorMessage('Voice narration is unavailable on this device.');
                },
            });
        },
        [speechChunks]
    );

    const handlePlayPause = () => {
        setErrorMessage(null);

        if (hasRemoteAudio) {
            try {
                if (playerStatus.playing) {
                    player.pause();
                } else {
                    player.play();
                }
            } catch {
                setErrorMessage('Could not play the devotional audio file.');
            }
            return;
        }

        // TTS fallback
        if (ttsState === 'playing') {
            ttsStateRef.current = 'paused';
            setTtsState('paused');
            Speech.stop();
            return;
        }

        const resumeIndex = ttsState === 'paused' ? ttsChunkIndex : 0;
        speakChunk(resumeIndex, speed);
    };

    const handleStop = () => {
        setErrorMessage(null);
        if (hasRemoteAudio) {
            try {
                player.pause();
                void player.seekTo(0);
            } catch {
                // ignore
            }
            return;
        }
        ttsStateRef.current = 'idle';
        setTtsState('idle');
        setTtsChunkIndex(0);
        Speech.stop();
    };

    const cycleSpeed = () => {
        const nextIndex = (SPEED_OPTIONS.indexOf(speed) + 1) % SPEED_OPTIONS.length;
        const nextSpeed = SPEED_OPTIONS[nextIndex];
        setSpeed(nextSpeed);
        speedRef.current = nextSpeed;

        if (hasRemoteAudio) {
            try {
                player.setPlaybackRate(nextSpeed);
            } catch {
                // fallback if rate change unsupported
            }
            return;
        }

        if (ttsState === 'playing') {
            Speech.stop();
            setTimeout(() => {
                speakChunk(ttsChunkIndex, nextSpeed);
            }, 60);
        }
    };

    const progressFraction = useMemo(() => {
        if (hasRemoteAudio) {
            if (!playerStatus.duration || playerStatus.duration <= 0) return 0;
            return Math.min(1, Math.max(0, playerStatus.currentTime / playerStatus.duration));
        }
        if (ttsState === 'idle') return 0;
        return Math.min(1, (ttsChunkIndex + 0.5) / Math.max(1, speechChunks.length));
    }, [hasRemoteAudio, playerStatus.currentTime, playerStatus.duration, ttsState, ttsChunkIndex, speechChunks.length]);

    const statusSubtitle = useMemo(() => {
        if (errorMessage) return errorMessage;
        if (hasRemoteAudio) {
            if (effectiveState === 'loading') return 'Loading recorded devotional audio…';
            if (playerStatus.duration > 0) {
                return `${formatDuration(playerStatus.currentTime)} / ${formatDuration(playerStatus.duration)}`;
            }
            return 'Recorded devotional audio';
        }
        if (ttsState === 'playing' || ttsState === 'paused') {
            return speechChunks[ttsChunkIndex]?.label || 'Reading aloud';
        }
        return 'Listen aloud';
    }, [
        errorMessage,
        hasRemoteAudio,
        effectiveState,
        playerStatus.currentTime,
        playerStatus.duration,
        ttsState,
        speechChunks,
        ttsChunkIndex,
    ]);

    return (
        <View
            style={[
                styles.container,
                compact && styles.compactContainer,
                {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                },
            ]}
            accessible
            accessibilityLabel="Devotional audio player"
        >
            <View style={styles.topRow}>
                {/* Play / Pause Button */}
                <TouchableOpacity
                    onPress={handlePlayPause}
                    style={[styles.playButton, { backgroundColor: colors.primary }]}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={effectiveState === 'playing' ? 'Pause audio' : 'Play devotional audio'}
                >
                    {effectiveState === 'loading' ? (
                        <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                        <Ionicons
                            name={effectiveState === 'playing' ? 'pause' : 'play'}
                            size={18}
                            color={colors.onPrimary}
                        />
                    )}
                </TouchableOpacity>

                {/* Title & Deterministic Waveform */}
                <View style={styles.infoColumn}>
                    <View style={styles.titleRow}>
                        <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
                            {hasRemoteAudio ? 'Pastor’s Audio Devotional' : 'Read Aloud'}
                        </Text>
                        <View style={styles.waveRow}>
                            {WAVE_BASE_HEIGHTS.map((baseH, idx) => {
                                const minH = 5;
                                const maxH = baseH * WAVE_PHASE_FACTORS[idx];
                                const animatedHeight = waveAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: idx % 2 === 0 ? [minH, maxH] : [maxH, minH],
                                });
                                return (
                                    <Animated.View
                                        key={idx}
                                        style={[
                                            styles.waveBar,
                                            {
                                                backgroundColor: colors.primary,
                                                opacity: effectiveState === 'playing' ? 0.85 : 0.3,
                                                height: effectiveState === 'playing' ? animatedHeight : 6,
                                            },
                                        ]}
                                    />
                                );
                            })}
                        </View>
                    </View>
                    <Text
                        style={[
                            styles.subtitleText,
                            { color: effectiveState === 'error' ? colors.error : colors.textSecondary },
                        ]}
                        numberOfLines={1}
                    >
                        {statusSubtitle}
                    </Text>
                </View>

                {/* Stop button when active */}
                {effectiveState !== 'idle' && (
                    <TouchableOpacity
                        onPress={handleStop}
                        style={[styles.secondaryBtn, { backgroundColor: colors.surface }]}
                        accessibilityRole="button"
                        accessibilityLabel="Stop audio"
                    >
                        <Ionicons name="stop" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                )}

                {/* Speed Control */}
                <TouchableOpacity
                    onPress={cycleSpeed}
                    style={[styles.speedBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Playback speed ${speed}x. Tap to change.`}
                >
                    <Text style={[styles.speedText, { color: colors.text }]}>{speed}x</Text>
                </TouchableOpacity>
            </View>

            {/* Progress Bar */}
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                    style={[
                        styles.progressFill,
                        {
                            backgroundColor: colors.primary,
                            width: `${Math.round(progressFraction * 100)}%`,
                        },
                    ]}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        padding: Spacing.md,
    },
    compactContainer: {
        paddingVertical: Spacing.sm,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    playButton: {
        width: TouchTarget.minWidth,
        height: TouchTarget.minHeight,
        borderRadius: BorderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoColumn: {
        flex: 1,
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    titleText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    subtitleText: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.micro,
        marginTop: 2,
    },
    waveRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 22,
        gap: 3,
    },
    waveBar: {
        width: 3,
        borderRadius: 2,
    },
    secondaryBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    speedBtn: {
        minHeight: 36,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    speedText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
    },
    progressTrack: {
        height: 3,
        borderRadius: 2,
        marginTop: Spacing.md,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
});
