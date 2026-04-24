"""
Email service for Phillip Capital Invest
"""
import logging
import httpx
import os

from database import db


class EmailService:
    @staticmethod
    async def get_settings():
        """Get email settings - merge ENV and database, DB password takes priority"""
        # First get from database
        db_settings = await db.admin_settings.find_one({"setting_id": "admin_settings"}, {"_id": 0})
        db_settings = db_settings or {}
        
        # For password: prefer database (avoids $ symbol issues in ENV)
        # For other settings: ENV overrides database
        smtp_password = db_settings.get('smtp_password') or os.environ.get('SMTP_PASSWORD')
        
        settings = {
            'email_enabled': os.environ.get('EMAIL_ENABLED', '').lower() == 'true' or db_settings.get('email_enabled', False),
            'email_provider': os.environ.get('EMAIL_PROVIDER') or db_settings.get('email_provider', 'sendgrid'),
            'sendgrid_api_key': os.environ.get('SENDGRID_API_KEY') or db_settings.get('sendgrid_api_key'),
            'smtp_host': os.environ.get('SMTP_HOST') or db_settings.get('smtp_host'),
            'smtp_port': os.environ.get('SMTP_PORT') or db_settings.get('smtp_port', '587'),
            'smtp_user': os.environ.get('SMTP_USER') or db_settings.get('smtp_user'),
            'smtp_password': smtp_password,  # DB takes priority to avoid $ issues
            'email_from': os.environ.get('EMAIL_FROM') or db_settings.get('email_from'),
            'email_from_name': os.environ.get('EMAIL_FROM_NAME') or db_settings.get('email_from_name', 'Phillip Capital Invest'),
        }
        
        return settings
    
    @staticmethod
    async def send_email(to_email: str, subject: str, html_content: str, to_name: str = None, attachments: list = None):
        """Send email using configured provider (SendGrid or SMTP)
        
        Args:
            attachments: List of dicts with keys: filename, content (base64), type (e.g., 'application/pdf')
        """
        settings = await EmailService.get_settings()
        
        # Check if email is enabled
        if not settings.get('email_enabled', False):
            logging.warning("Email sending is disabled")
            return False
        
        # Get sender info
        sender_email = settings.get('email_from') or settings.get('sender_email')
        sender_name = settings.get('email_from_name') or settings.get('sender_name', 'Phillip Capital Invest')
        
        if not sender_email:
            logging.warning("Email not configured - email_from missing")
            return False
        
        # Determine provider
        provider = settings.get('email_provider', 'sendgrid')
        use_smtp = provider == 'smtp' or settings.get('use_smtp', False)
        
        if use_smtp:
            return await EmailService._send_smtp(
                to_email, to_name, subject, html_content,
                sender_email, sender_name, settings, attachments
            )
        else:
            return await EmailService._send_sendgrid(
                to_email, to_name, subject, html_content,
                sender_email, sender_name, settings, attachments
            )
    
    @staticmethod
    async def _send_sendgrid(to_email, to_name, subject, html_content, sender_email, sender_name, settings, attachments=None):
        """Send email via SendGrid API"""
        api_key = settings.get('sendgrid_api_key')
        if not api_key:
            logging.warning("SendGrid API key not configured")
            return False
        
        try:
            payload = {
                "personalizations": [{
                    "to": [{"email": to_email, "name": to_name or to_email}]
                }],
                "from": {"email": sender_email, "name": sender_name},
                "subject": subject,
                "content": [{"type": "text/html", "value": html_content}]
            }
            
            # Add attachments if provided
            if attachments:
                payload["attachments"] = [
                    {
                        "content": att["content"],  # base64 encoded
                        "filename": att["filename"],
                        "type": att.get("type", "application/pdf"),
                        "disposition": "attachment"
                    }
                    for att in attachments
                ]
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json=payload,
                    timeout=30.0
                )
                if response.status_code in [200, 202]:
                    logging.info(f"Email sent to {to_email}")
                    return True
                else:
                    logging.error(f"SendGrid error: {response.status_code} - {response.text}")
                    return False
        except Exception as e:
            logging.error(f"SendGrid exception: {str(e)}")
            return False
    
    @staticmethod
    async def _send_smtp(to_email, to_name, subject, html_content, sender_email, sender_name, settings, attachments=None):
        """Send email via SMTP"""
        import smtplib
        import base64
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        from email.mime.base import MIMEBase
        from email import encoders
        
        smtp_host = settings.get('smtp_host')
        smtp_port_raw = settings.get('smtp_port') or '587'
        # Handle port as string or int
        try:
            smtp_port = int(str(smtp_port_raw).strip())
        except:
            smtp_port = 587
            
        smtp_username = settings.get('smtp_user') or settings.get('smtp_username')
        smtp_password = settings.get('smtp_password')
        
        logging.info(f"SMTP Config: host={smtp_host}, port={smtp_port}, user={smtp_username}, from={sender_email}")
        
        if not all([smtp_host, smtp_username, smtp_password]):
            logging.warning(f"SMTP not fully configured: host={bool(smtp_host)}, user={bool(smtp_username)}, pass={bool(smtp_password)}")
            return False
        
        try:
            msg = MIMEMultipart('mixed')
            msg['Subject'] = subject
            msg['From'] = f"{sender_name} <{sender_email}>"
            msg['To'] = to_email
            
            # Add HTML content
            html_part = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(html_part)
            
            # Add attachments
            if attachments:
                for att in attachments:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(base64.b64decode(att["content"]))
                    encoders.encode_base64(part)
                    part.add_header(
                        'Content-Disposition',
                        f'attachment; filename="{att["filename"]}"'
                    )
                    msg.attach(part)
            
            # Port 465 uses SSL directly, port 587 uses STARTTLS
            if smtp_port == 465:
                import ssl
                context = ssl.create_default_context()
                logging.info(f"Connecting to SMTP SSL {smtp_host}:{smtp_port}")
                with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=30) as server:
                    server.set_debuglevel(0)
                    logging.info("SMTP SSL connected, logging in...")
                    server.login(smtp_username, smtp_password)
                    logging.info("SMTP logged in, sending...")
                    result = server.sendmail(sender_email, [to_email], msg.as_string())
                    logging.info(f"SMTP sendmail result: {result}")
            else:
                logging.info(f"Connecting to SMTP STARTTLS {smtp_host}:{smtp_port}")
                with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
                    server.starttls()
                    server.login(smtp_username, smtp_password)
                    server.sendmail(sender_email, [to_email], msg.as_string())
            
            logging.info(f"SMTP email successfully sent to {to_email}")
            return True
        except smtplib.SMTPAuthenticationError as e:
            logging.error(f"SMTP Authentication failed: {str(e)}")
            return False
        except smtplib.SMTPRecipientsRefused as e:
            logging.error(f"SMTP Recipients refused: {str(e)}")
            return False
        except smtplib.SMTPException as e:
            logging.error(f"SMTP Exception: {str(e)}")
            return False
        except Exception as e:
            logging.error(f"SMTP general exception: {type(e).__name__}: {str(e)}")
            return False
    
    @staticmethod
    async def send_template_email(to_email: str, template_name: str, variables: dict, language: str = "ru"):
        """Send email using a template"""
        # Get template
        template = await db.email_templates.find_one({"name": template_name, "is_active": True}, {"_id": 0})
        
        if not template:
            logging.warning(f"Email template '{template_name}' not found")
            return False
        
        # Get subject and content in user's language
        subject = template.get('subject', {}).get(language) or template.get('subject', {}).get('en', '')
        content = template.get('content', {}).get(language) or template.get('content', {}).get('en', '')
        
        # Replace variables
        for key, value in variables.items():
            subject = subject.replace(f"{{{{{key}}}}}", str(value))
            content = content.replace(f"{{{{{key}}}}}", str(value))
        
        return await EmailService.send_email(to_email, subject, content)
