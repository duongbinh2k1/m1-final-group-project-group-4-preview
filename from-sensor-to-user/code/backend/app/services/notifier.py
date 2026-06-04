"""
Telegram Bot notification service.

Setup:
1. Tạo bot: nhắn @BotFather trên Telegram → /newbot → copy token
2. Lấy chat_id: nhắn bot bất kỳ tin nhắn, rồi mở:
   https://api.telegram.org/bot<TOKEN>/getUpdates
   → tìm "chat":{"id": ...}
3. Thêm vào .env:
   TELEGRAM_BOT_TOKEN=123456:ABC...
   TELEGRAM_CHAT_ID=987654321

Notification logic:
- Chỉ gửi khi status THAY ĐỔI sang warning hoặc critical
- Khi status về healthy lại → gửi tin "bình thường trở lại"
- Không spam nếu status vẫn giữ nguyên
"""
from __future__ import annotations

import httpx

from app.models.enums import HealthStatus

_ALERT_MESSAGES: dict[HealthStatus, str] = {
    HealthStatus.warning:  "⚠️ *Cảnh báo:* Cây đang trong tình trạng cần chú ý.",
    HealthStatus.critical: "🚨 *Nghiêm trọng:* Cây đang trong tình trạng nguy hiểm! Hành động ngay!",
}

_RECOVERY_MESSAGE = "✅ *Bình thường trở lại:* Cây đã về trạng thái healthy."

_last_sent_status: HealthStatus | None = None


async def notify_status_change(
    new_status: HealthStatus,
    bot_token: str,
    chat_id: str,
) -> None:
    """Send Telegram alert only when status actually changes."""
    global _last_sent_status

    if new_status == _last_sent_status:
        return  # no change — skip

    _last_sent_status = new_status

    if not bot_token or not chat_id:
        return

    if new_status == HealthStatus.healthy:
        text = f"🍄 *Mushroom Farm*\n\n{_RECOVERY_MESSAGE}"
    else:
        msg = _ALERT_MESSAGES.get(new_status, f"Status: {new_status.value}")
        text = f"🍄 *Mushroom Farm Alert*\n\n{msg}"

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(url, json={
                "chat_id":    chat_id,
                "text":       text,
                "parse_mode": "Markdown",
            })
            print(f"[Telegram] Sent alert: {new_status.value}")
    except Exception as exc:
        print(f"[Telegram] Failed to send: {exc}")
