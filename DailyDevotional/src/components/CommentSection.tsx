import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, TouchTarget } from '../constants/theme';
import { CommunityComment, ReactionKey } from '../types';
import { useAuthStore } from '../store/authStore';
import {
    fetchDevotionalComments,
    fetchDevotionalCompletionCount,
    postCommunityComment,
    toggleCommunityReaction,
    deleteOwnCommunityComment,
    reportCommunityComment,
} from '../services/community';

interface CommentSectionProps {
    devotionalId: string;
    darkMode: boolean;
    onRequireSignIn?: () => void;
}

const REACTION_META: { key: ReactionKey; emoji: string; label: string }[] = [
    { key: 'amen', emoji: '🙏', label: 'Amen' },
    { key: 'heart', emoji: '❤️', label: '' },
    { key: 'fire', emoji: '🔥', label: '' },
];

const REPORT_REASONS = [
    'Off-topic or spam',
    'Unkind or disrespectful language',
    'Inappropriate content',
    'Needs pastoral attention',
];

export default function CommentSection({
    devotionalId,
    darkMode,
    onRequireSignIn,
}: CommentSectionProps) {
    const colors = darkMode ? Colors.dark : Colors.light;
    const { user, isGuest } = useAuthStore();

    const [comments, setComments] = useState<CommunityComment[]>([]);
    const [completionCount, setCompletionCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [newComment, setNewComment] = useState<string>('');
    const [replyingTo, setReplyingTo] = useState<CommunityComment | null>(null);
    const [reportingComment, setReportingComment] = useState<CommunityComment | null>(null);

    const loadCommunity = useCallback(async () => {
        if (!devotionalId) return;
        setIsLoading(true);
        setError(null);
        try {
            const [loadedComments, count] = await Promise.all([
                fetchDevotionalComments(devotionalId),
                fetchDevotionalCompletionCount(devotionalId),
            ]);
            setComments(loadedComments);
            setCompletionCount(count);
        } catch (err) {
            console.warn('Error loading community:', err);
            setError('Unable to load community reflections right now.');
        } finally {
            setIsLoading(false);
        }
    }, [devotionalId]);

    useEffect(() => {
        void loadCommunity();
    }, [loadCommunity]);

    const topLevelComments = comments.filter((c) => !c.parentId);
    const getReplies = (parentId: string) => comments.filter((c) => c.parentId === parentId);

    const handlePost = async () => {
        const trimmed = newComment.trim();
        if (!trimmed || isSubmitting) return;

        if (isGuest || !user) {
            Alert.alert(
                'Sign In to Share',
                'Create a free church account to share reflections and encourage others.',
                [
                    { text: 'Not Now', style: 'cancel' },
                    ...(onRequireSignIn ? [{ text: 'Sign In', onPress: onRequireSignIn }] : []),
                ]
            );
            return;
        }

        setIsSubmitting(true);
        try {
            const created = await postCommunityComment({
                devotionalId,
                content: trimmed,
                parentId: replyingTo ? replyingTo.id : null,
            });
            setComments((prev) => [...prev, created]);
            setNewComment('');
            setReplyingTo(null);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Could not post your reflection.';
            Alert.alert('Unable to Post', msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleReaction = async (comment: CommunityComment, reaction: ReactionKey) => {
        if (isGuest || !user) {
            Alert.alert('Sign In Required', 'Please sign in to react to community reflections.');
            return;
        }

        // Optimistic update
        const previousReactions = comment.reactions;
        const currentList = previousReactions[reaction];
        const hasReacted = currentList.includes(user.uid);
        const optimisticList = hasReacted
            ? currentList.filter((id) => id !== user.uid)
            : [...currentList, user.uid];

        setComments((prev) =>
            prev.map((c) =>
                c.id === comment.id
                    ? { ...c, reactions: { ...c.reactions, [reaction]: optimisticList } }
                    : c
            )
        );

        try {
            const updated = await toggleCommunityReaction({
                devotionalId,
                commentId: comment.id,
                reaction,
            });
            setComments((prev) =>
                prev.map((c) => (c.id === comment.id ? { ...c, reactions: updated } : c))
            );
        } catch {
            // Rollback optimistic reaction
            setComments((prev) =>
                prev.map((c) =>
                    c.id === comment.id ? { ...c, reactions: previousReactions } : c
                )
            );
        }
    };

    const handleDelete = (comment: CommunityComment) => {
        Alert.alert(
            'Delete Reflection',
            'Are you sure you want to remove your reflection?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteOwnCommunityComment({
                                devotionalId,
                                commentId: comment.id,
                            });
                            setComments((prev) =>
                                prev.filter((c) => c.id !== comment.id && c.parentId !== comment.id)
                            );
                        } catch (err) {
                            const msg =
                                err instanceof Error ? err.message : 'Unable to delete comment.';
                            Alert.alert('Error', msg);
                        }
                    },
                },
            ]
        );
    };

    const handleReportReason = async (reason: string) => {
        const target = reportingComment;
        setReportingComment(null);
        if (!target) return;

        try {
            await reportCommunityComment({
                devotionalId,
                commentId: target.id,
                reason,
            });
            Alert.alert(
                'Thank You',
                'This comment has been shared with our pastoral moderation team for review.'
            );
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Could not submit report.';
            Alert.alert('Unable to Report', msg);
        }
    };

    const formatRelativeTime = (iso: string): string => {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    const renderCommentItem = (comment: CommunityComment, isReply = false) => {
        const replies = isReply ? [] : getReplies(comment.id);
        const isOwner = Boolean(user && !isGuest && comment.authorId === user.uid);

        return (
            <View
                key={comment.id}
                style={[
                    isReply ? styles.replyWrapper : styles.commentWrapper,
                    isReply && { borderLeftColor: colors.border },
                ]}
            >
                <View
                    style={[
                        styles.commentCard,
                        {
                            backgroundColor: isReply ? colors.surfaceElevated : colors.surface,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <View style={styles.authorRow}>
                        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                            <Text style={[styles.avatarText, { color: colors.primary }]}>
                                {(comment.authorName || 'M').charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <View style={styles.authorMeta}>
                            <Text style={[styles.authorName, { color: colors.text }]}>
                                {comment.authorName}
                            </Text>
                            <Text style={[styles.timeText, { color: colors.textTertiary }]}>
                                {formatRelativeTime(comment.createdAt)}
                            </Text>
                        </View>

                        {isOwner ? (
                            <TouchableOpacity
                                onPress={() => handleDelete(comment)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                accessibilityRole="button"
                                accessibilityLabel="Delete your reflection"
                            >
                                <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                            </TouchableOpacity>
                        ) : (
                            !isGuest && (
                                <TouchableOpacity
                                    onPress={() => setReportingComment(comment)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Report reflection"
                                >
                                    <Ionicons name="flag-outline" size={15} color={colors.textTertiary} />
                                </TouchableOpacity>
                            )
                        )}
                    </View>

                    <Text style={[styles.contentText, { color: colors.text }]}>
                        {comment.content}
                    </Text>

                    <View style={styles.actionsRow}>
                        <View style={styles.reactionsGroup}>
                            {REACTION_META.map(({ key, emoji, label }) => {
                                const list = comment.reactions[key] || [];
                                const count = list.length;
                                const active = Boolean(user && list.includes(user.uid));
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        onPress={() => handleToggleReaction(comment, key)}
                                        style={[
                                            styles.reactionPill,
                                            {
                                                backgroundColor: active
                                                    ? colors.primarySoft
                                                    : colors.surfaceElevated,
                                                borderColor: active ? colors.primary : 'transparent',
                                            },
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${label || emoji} reaction, ${count}`}
                                    >
                                        <Text style={styles.reactionEmoji}>{emoji}</Text>
                                        {label ? (
                                            <Text
                                                style={[
                                                    styles.reactionLabel,
                                                    { color: active ? colors.primary : colors.textSecondary },
                                                ]}
                                            >
                                                {label}
                                            </Text>
                                        ) : null}
                                        {count > 0 && (
                                            <Text
                                                style={[
                                                    styles.reactionCount,
                                                    { color: active ? colors.primary : colors.textSecondary },
                                                ]}
                                            >
                                                {count}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {!isReply && (
                            <TouchableOpacity
                                onPress={() => setReplyingTo(comment)}
                                style={styles.replyButton}
                                accessibilityRole="button"
                                accessibilityLabel={`Reply to ${comment.authorName}`}
                            >
                                <Ionicons name="return-down-forward-outline" size={15} color={colors.textSecondary} />
                                <Text style={[styles.replyText, { color: colors.textSecondary }]}>Reply</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {replies.map((reply) => renderCommentItem(reply, true))}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Section Title & Church Activity Subtitle */}
            <View style={styles.headerRow}>
                <View>
                    <Text style={[styles.sectionEyebrow, { color: colors.primary }]}>
                        TODAY’S COMMUNITY
                    </Text>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        Reflections from the Church
                    </Text>
                </View>
                {completionCount > 0 && (
                    <View style={[styles.activityPill, { backgroundColor: colors.sageSoft }]}>
                        <Ionicons name="people-outline" size={14} color={colors.sage} />
                        <Text style={[styles.activityPillText, { color: colors.sage }]}>
                            {completionCount} completed
                        </Text>
                    </View>
                )}
            </View>

            {/* Input Composer */}
            <View
                style={[
                    styles.composerCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
            >
                {replyingTo && (
                    <View style={[styles.replyBanner, { backgroundColor: colors.surfaceElevated }]}>
                        <Text style={[styles.replyBannerText, { color: colors.textSecondary }]}>
                            Replying to {replyingTo.authorName}
                        </Text>
                        <TouchableOpacity
                            onPress={() => setReplyingTo(null)}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel reply"
                        >
                            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                )}
                <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={newComment}
                    onChangeText={setNewComment}
                    placeholder={
                        isGuest
                            ? 'Sign in to share what today’s reading taught you…'
                            : 'Share a reflection or word of encouragement…'
                    }
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    maxLength={1000}
                    accessibilityLabel="Write a community reflection"
                />
                <View style={styles.composerFooter}>
                    <Text style={[styles.charCount, { color: colors.textTertiary }]}>
                        {newComment.length}/1000
                    </Text>
                    <TouchableOpacity
                        onPress={handlePost}
                        disabled={!newComment.trim() || isSubmitting}
                        style={[
                            styles.postButton,
                            {
                                backgroundColor: newComment.trim()
                                    ? colors.primary
                                    : colors.surfaceElevated,
                            },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Post reflection"
                    >
                        {isSubmitting ? (
                            <ActivityIndicator size="small" color={colors.onPrimary} />
                        ) : (
                            <Text
                                style={[
                                    styles.postButtonText,
                                    { color: newComment.trim() ? colors.onPrimary : colors.textTertiary },
                                ]}
                            >
                                {replyingTo ? 'Post Reply' : 'Share Reflection'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* States & List */}
            {isLoading ? (
                <View style={styles.stateBox}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                        Loading community reflections…
                    </Text>
                </View>
            ) : error ? (
                <View style={styles.stateBox}>
                    <Text style={[styles.stateText, { color: colors.textSecondary }]}>{error}</Text>
                    <TouchableOpacity
                        onPress={loadCommunity}
                        style={[styles.retryBtn, { borderColor: colors.border }]}
                    >
                        <Text style={[styles.retryBtnText, { color: colors.primary }]}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : topLevelComments.length === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                        Be the first to share what today’s devotional taught you.
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                        Your reflection can encourage someone else in the church today.
                    </Text>
                </View>
            ) : (
                <View style={styles.commentsList}>
                    {topLevelComments.map((c) => renderCommentItem(c))}
                </View>
            )}

            {/* Report Modal */}
            <Modal
                visible={Boolean(reportingComment)}
                transparent
                animationType="fade"
                onRequestClose={() => setReportingComment(null)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
                    <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            Report Reflection
                        </Text>
                        <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                            Help keep our church community encouraging and Christ-centered.
                        </Text>
                        {REPORT_REASONS.map((reason) => (
                            <TouchableOpacity
                                key={reason}
                                style={[styles.reasonRow, { borderBottomColor: colors.divider }]}
                                onPress={() => handleReportReason(reason)}
                            >
                                <Text style={[styles.reasonText, { color: colors.text }]}>{reason}</Text>
                                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={styles.cancelReportBtn}
                            onPress={() => setReportingComment(null)}
                        >
                            <Text style={[styles.cancelReportText, { color: colors.textSecondary }]}>
                                Cancel
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: Spacing.xxl,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: Spacing.lg,
    },
    sectionEyebrow: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
    },
    sectionTitle: {
        fontFamily: Typography.fontFamily.serifSemiBold,
        fontSize: Typography.sizes.title,
        marginTop: 4,
    },
    activityPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
        gap: 6,
    },
    activityPillText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
    },
    composerCard: {
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
    },
    replyBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.xs,
        marginBottom: Spacing.sm,
    },
    replyBannerText: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.caption,
    },
    input: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.body,
        lineHeight: 22,
        minHeight: 68,
        textAlignVertical: 'top',
    },
    composerFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    charCount: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.micro,
    },
    postButton: {
        minHeight: 38,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    postButtonText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    commentsList: {
        gap: Spacing.md,
    },
    commentWrapper: {
        marginBottom: Spacing.sm,
    },
    replyWrapper: {
        marginLeft: Spacing.xl,
        marginTop: Spacing.sm,
        paddingLeft: Spacing.md,
        borderLeftWidth: 2,
    },
    commentCard: {
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        padding: Spacing.lg,
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
        gap: Spacing.sm,
    },
    avatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    authorMeta: {
        flex: 1,
    },
    authorName: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    timeText: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.micro,
    },
    contentText: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.body,
        lineHeight: 23,
        marginBottom: Spacing.md,
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    reactionsGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    reactionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 34,
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        gap: 4,
    },
    reactionEmoji: {
        fontSize: 13,
    },
    reactionLabel: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.micro,
    },
    reactionCount: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
    },
    replyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 34,
        paddingHorizontal: Spacing.sm,
        gap: 4,
    },
    replyText: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.caption,
    },
    stateBox: {
        paddingVertical: Spacing.xl,
        alignItems: 'center',
        gap: Spacing.sm,
    },
    stateText: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.caption,
        textAlign: 'center',
    },
    retryBtn: {
        marginTop: Spacing.xs,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
    },
    retryBtnText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    emptyBox: {
        borderRadius: BorderRadius.md,
        padding: Spacing.xl,
        alignItems: 'center',
        gap: Spacing.xs,
    },
    emptyTitle: {
        fontFamily: Typography.fontFamily.serifMedium,
        fontSize: Typography.sizes.body,
        textAlign: 'center',
        marginTop: Spacing.xs,
    },
    emptySubtitle: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.caption,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    modalSheet: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.xl,
    },
    modalTitle: {
        fontFamily: Typography.fontFamily.serifSemiBold,
        fontSize: Typography.sizes.subtitle,
    },
    modalSubtitle: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.caption,
        marginTop: 4,
        marginBottom: Spacing.lg,
    },
    reasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: TouchTarget.minHeight,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
    },
    reasonText: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.body,
    },
    cancelReportBtn: {
        minHeight: TouchTarget.minHeight,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.md,
    },
    cancelReportText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.body,
    },
});
