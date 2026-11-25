import { Share, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Devotional } from '../types';
import { formatShortDate } from '../lib/date';

/**
 * Share a devotional entry via the native share sheet.
 */
export async function shareDevotional(devotional: Devotional): Promise<void> {
    const shareText = buildShareText(devotional);

    try {
        await Share.share(
            {
                message: shareText,
                title: `${devotional.title} — Daily Devotional`,
                ...(Platform.OS === 'ios' ? { url: '' } : {}),
            },
            {
                dialogTitle: 'Share Devotional',
                subject: `${devotional.title} — Daily Devotional`,
            }
        );
    } catch {
        // User cancelled share sheet
    }
}

/**
 * Copy a passage or the full scripture + devotional excerpt to clipboard.
 */
export async function copyDevotionalExcerpt(
    devotional: Devotional,
    customText?: string
): Promise<boolean> {
    try {
        const text = customText
            ? `"${customText}"\n— ${devotional.title} (${devotional.scriptureReference})`
            : buildShareText(devotional);
        await Clipboard.setStringAsync(text);
        return true;
    } catch (err) {
        console.warn('Clipboard copy failed:', err);
        return false;
    }
}

function buildShareText(devotional: Devotional): string {
    const bodyPreview =
        devotional.body.length > 260
            ? devotional.body.substring(0, 260).trim() + '…'
            : devotional.body;

    const lines = [
        `DAY ${devotional.dayNumber} · ${formatShortDate(devotional.date)}`,
        devotional.title,
        '',
        `"${devotional.scriptureText}"`,
        `— ${devotional.scriptureReference}`,
        '',
        bodyPreview,
    ];

    if (devotional.prayer) {
        const prayerExcerpt =
            devotional.prayer.length > 140
                ? devotional.prayer.substring(0, 140).trim() + '…'
                : devotional.prayer;
        lines.push('', `Prayer: ${prayerExcerpt}`);
    }

    return lines.join('\n');
}

export function getShareCardData(devotional: Devotional) {
    return {
        title: devotional.title,
        scripture: devotional.scriptureReference,
        scriptureText: devotional.scriptureText,
        day: devotional.dayNumber,
        date: devotional.date,
    };
}
