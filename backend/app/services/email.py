"""
Transactional email sender for MindLift.
Uses Python's built-in smtplib; SMTP credentials come from settings.
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings


def _send(recipient_email: str, subject: str, body_text: str, body_html: str) -> None:
    """Internal helper — builds MIME message and sends via SMTP."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.emails_from_email
    msg["To"] = recipient_email
    msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.ehlo()
        server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.emails_from_email, recipient_email, msg.as_string())


def _smtp_configured() -> bool:
    return bool(
        settings.smtp_host
        and not (settings.smtp_host == "localhost" and not settings.smtp_user)
    )


def send_password_reset_email(recipient_email: str, reset_url: str) -> None:
    """
    Send a password-reset link. Link is valid for 30 minutes (enforced by Redis TTL).
    Logs and returns silently if SMTP is not configured.
    """
    if not _smtp_configured():
        print(
            f"[email] SMTP not configured — password reset URL for {recipient_email}: {reset_url}"
        )
        return

    subject = "Reset your MindLift password"
    body_text = (
        "You requested a password reset for your MindLift account.\n\n"
        f"Reset link (valid for 30 minutes):\n{reset_url}\n\n"
        "If you did not request this, you can ignore this email.\n\n"
        "— The MindLift Team"
    )
    body_html = f"""\
<html><body>
<p>You requested a password reset for your MindLift account.</p>
<p><a href="{reset_url}">Reset your password</a> (link valid for 30 minutes)</p>
<p>If you did not request this, you can ignore this email.</p>
<p>— The MindLift Team</p>
</body></html>"""
    _send(recipient_email, subject, body_text, body_html)


def send_export_ready_email(recipient_email: str, download_url: str) -> None:
    """
    Send an export-ready notification email with the 15-minute signed download link.
    Logs and returns silently if SMTP is not configured (local / dev environment).
    """
    if not _smtp_configured():
        print(
            f"[email] SMTP not configured — export URL for {recipient_email}: {download_url}"
        )
        return

    subject = "Your MindLift data export is ready"
    body_text = (
        "Your MindLift data export is ready for download.\n\n"
        f"Download link (valid for 15 minutes):\n{download_url}\n\n"
        "If you did not request this export, please contact support.\n\n"
        "— The MindLift Team"
    )
    body_html = f"""\
<html><body>
<p>Your MindLift data export is ready for download.</p>
<p><a href="{download_url}">Download your data</a> (link valid for 15 minutes)</p>
<p>If you did not request this export, please contact support.</p>
<p>— The MindLift Team</p>
</body></html>"""
    _send(recipient_email, subject, body_text, body_html)
