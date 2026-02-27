import axios from 'axios'
import { getConfig } from './config'

/**
 * Phase 5: Send notification to Telegram
 */
export async function sendNotification(message: string, parseMode: 'HTML' | 'Markdown' = 'HTML') {
    const botToken = await getConfig('TELEGRAM_BOT_TOKEN')
    const chatId = await getConfig('TELEGRAM_CHAT_ID')

    if (!botToken || !chatId) {
        console.warn('Telegram Bot Token or Chat ID is missing. Notification skipped.')
        return
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`

    try {
        await axios.post(url, {
            chat_id: chatId,
            text: message,
            parse_mode: parseMode
        })
        console.log('Telegram notification sent.')
    } catch (err) {
        console.error('Failed to send Telegram notification:', err)
    }
}

/**
 * Send image report to Telegram
 */
export async function sendImageReport(photoPath: string, caption: string) {
    // Logic for sending photos will use multipart/form-data
    console.log('Sending image to Telegram:', photoPath)
}
