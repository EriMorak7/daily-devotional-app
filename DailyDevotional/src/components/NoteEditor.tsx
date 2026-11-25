import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface NoteEditorProps {
    initialContent?: string;
    onSave: (content: string) => void;
    onCancel: () => void;
    onDelete?: () => void;
    darkMode: boolean;
    isEditing?: boolean;
}

export default function NoteEditor({
    initialContent = '',
    onSave,
    onCancel,
    onDelete,
    darkMode,
    isEditing = false,
}: NoteEditorProps) {
    const [content, setContent] = useState(initialContent);
    const colors = darkMode ? Colors.dark : Colors.light;

    const handleSave = () => {
        const trimmed = content.trim();
        if (trimmed) {
            onSave(trimmed);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}
        >
            {/* Header */}
            <View style={styles.header}>
                <Ionicons name="create" size={16} color={colors.primary} />
                <Text style={[styles.title, { color: colors.text }]}>
                    {isEditing ? 'Edit Note' : 'Add Note'}
                </Text>
                <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Text Input */}
            <TextInput
                style={[styles.input, {
                    color: colors.text,
                    backgroundColor: darkMode ? colors.surfaceElevated : '#F8F9FE',
                    borderColor: colors.border,
                }]}
                value={content}
                onChangeText={setContent}
                placeholder="Write your personal reflection..."
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
                autoFocus
            />

            {/* Action Buttons */}
            <View style={styles.actions}>
                {onDelete && isEditing && (
                    <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                        <Text style={[styles.deleteText, { color: colors.error }]}>Delete</Text>
                    </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                    onPress={onCancel}
                    style={[styles.cancelButton, { borderColor: colors.border }]}
                >
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={!content.trim()}
                    style={[
                        styles.saveButton,
                        {
                            backgroundColor: content.trim() ? colors.primary : colors.border,
                        },
                    ]}
                >
                    <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
                    <Text style={[styles.saveText, { color: colors.onPrimary }]}>Save</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
        paddingBottom: Spacing.xxl,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    title: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.body,
        flex: 1,
    },
    input: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.body,
        lineHeight: 24,
        minHeight: 120,
        maxHeight: 200,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        gap: 4,
    },
    deleteText: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.caption,
    },
    cancelButton: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
    },
    cancelText: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.body,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        borderRadius: BorderRadius.md,
        gap: 4,
    },
    saveText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.body,
        color: '#FFFFFF',
    },
});
