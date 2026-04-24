"""
Contracts router for Phillip Capital Invest - PDF generation, contract templates
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
import uuid
import io
import base64
import logging

# ReportLab imports for PDF generation
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from database import db

router = APIRouter(tags=["contracts"])

logger = logging.getLogger(__name__)


async def get_current_user(request: Request) -> dict:
    """Get current user from session"""
    # First try Authorization header (Safari ITP compatibility)
    auth_header = request.headers.get("Authorization")
    session_token = None
    if auth_header and auth_header.startswith("Bearer "):
        session_token = auth_header[7:]
    # Fallback to cookie
    if not session_token:
        session_token = request.cookies.get("session_token")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


async def get_admin_user(request: Request) -> dict:
    """Get current admin user"""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ==================== CONTRACT PDF GENERATION ====================

@router.get("/investments/{investment_id}/contract")
async def get_contract_pdf(investment_id: str, request: Request):
    """Generate and download professional contract PDF with company signature and stamp"""
    user = await get_current_user(request)
    
    investment = await db.investments.find_one(
        {"investment_id": investment_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    portfolio = await db.portfolios.find_one(
        {"portfolio_id": investment["portfolio_id"]},
        {"_id": 0}
    )
    
    # Get admin settings for company signature and stamp
    admin_settings = await db.admin_settings.find_one({"setting_id": "admin_settings"}, {"_id": 0}) or {}
    
    lang = user.get("preferred_language", "ru")
    
    # Create PDF buffer
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )
    
    # Register DejaVuSans font with Cyrillic support
    try:
        pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
        FONT_REGULAR = 'DejaVuSans'
        FONT_BOLD = 'DejaVuSans-Bold'
    except Exception as e:
        logger.warning(f"Could not load DejaVuSans font: {e}")
        FONT_REGULAR = 'Helvetica'
        FONT_BOLD = 'Helvetica-Bold'
    
    # Define professional styles
    title_style = ParagraphStyle(
        'ContractTitle',
        fontSize=16,
        spaceAfter=6,
        alignment=TA_CENTER,
        textColor=colors.black,
        fontName=FONT_BOLD,
        leading=20
    )
    
    subtitle_style = ParagraphStyle(
        'ContractSubtitle',
        fontSize=12,
        spaceAfter=20,
        alignment=TA_CENTER,
        fontName=FONT_REGULAR,
        leading=16
    )
    
    heading_style = ParagraphStyle(
        'SectionHeading',
        fontSize=11,
        spaceBefore=16,
        spaceAfter=8,
        textColor=colors.black,
        fontName=FONT_BOLD,
        leading=14
    )
    
    normal_style = ParagraphStyle(
        'ContractNormal',
        fontSize=10,
        spaceAfter=6,
        leading=14,
        fontName=FONT_REGULAR,
        alignment=TA_JUSTIFY
    )
    
    small_style = ParagraphStyle(
        'ContractSmall',
        fontSize=8,
        textColor=colors.gray,
        spaceAfter=4,
        fontName=FONT_REGULAR,
        leading=10
    )
    
    center_style = ParagraphStyle(
        'CenterStyle',
        fontSize=10,
        alignment=TA_CENTER,
        fontName=FONT_REGULAR,
        leading=14
    )
    
    # Parse dates
    created_at = investment.get('created_at', '')
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        except:
            created_at = datetime.now(timezone.utc)
    
    end_date = investment.get('end_date', '')
    if isinstance(end_date, str):
        try:
            end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except:
            end_date = datetime.now(timezone.utc)
    
    portfolio_name = portfolio['name'].get(lang, portfolio['name'].get('ru', 'N/A')) if portfolio else 'N/A'
    
    # Company info from settings
    company_name = admin_settings.get('company_name', 'Phillip Capital Invest LLP')
    company_director = admin_settings.get('company_director', 'Иванов И.И.')
    company_director_title = admin_settings.get('company_director_title', 'Генеральный директор')
    company_license = admin_settings.get('company_license', 'Лицензия НБ РК №1.2.34/567')
    company_bin = admin_settings.get('company_bin', '123456789012')
    company_address = admin_settings.get('company_address', 'г. Алматы')
    
    # Get support email from site settings
    site_settings = await db.site_settings.find_one({"setting_id": "contact_info"}, {"_id": 0})
    support_email = "support@altyncontrac.help"
    if site_settings and site_settings.get("email"):
        support_email = site_settings.get("email")
    
    # Content
    content = []
    
    # ===== HEADER =====
    content.append(Paragraph(company_name.upper(), title_style))
    content.append(Spacer(1, 5))
    content.append(HRFlowable(width="100%", thickness=2, color=colors.black))
    content.append(Spacer(1, 15))
    
    content.append(Paragraph("ИНВЕСТИЦИОННЫЙ ДОГОВОР", subtitle_style))
    content.append(Paragraph(f"№ {investment_id}", center_style))
    content.append(Spacer(1, 20))
    
    # Location and date
    right_align_style = ParagraphStyle('RightAlign', fontSize=10, alignment=2, fontName=FONT_BOLD, leading=14)
    header_data = [
        [Paragraph(f"<b>{company_address}</b>", normal_style), 
         Paragraph(f"<b>{created_at.strftime('%d.%m.%Y') if isinstance(created_at, datetime) else ''}</b>", right_align_style)]
    ]
    header_table = Table(header_data, colWidths=[8*cm, 8*cm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    content.append(header_table)
    content.append(Spacer(1, 15))
    
    # ===== PARTIES INTRODUCTION =====
    intro_text = f"""
<b>{company_name}</b>, в лице {company_director_title} {company_director}, действующего на основании Устава, 
именуемое в дальнейшем «Компания», с одной стороны, и
<br/><br/>
Гражданин(ка) <b>{user.get('name', 'Клиент')}</b>, именуемый(ая) в дальнейшем «Инвестор», 
с другой стороны, совместно именуемые «Стороны», заключили настоящий Договор о нижеследующем:
"""
    content.append(Paragraph(intro_text, normal_style))
    content.append(Spacer(1, 10))
    
    # Check if portfolio has custom contract template
    contract_template = portfolio.get('contract_template', {}).get(lang, '') if portfolio else ''
    
    # Prepare duration label for templates
    duration_val = investment.get('duration_months', investment.get('term_months', 12))
    duration_unit_val = portfolio.get('duration_unit', 'months') if portfolio else 'months'
    if duration_unit_val == 'hours':
        duration_label_template = f"{duration_val} ч."
    elif duration_unit_val == 'days':
        duration_label_template = f"{duration_val} дн."
    elif duration_unit_val == 'years':
        duration_label_template = f"{duration_val} г."
    else:
        duration_label_template = f"{duration_val} мес."
    
    # Get term rate
    returns_by_term_template = portfolio.get('returns_by_term', {}) if portfolio else {}
    term_rate_template = returns_by_term_template.get(str(duration_val), portfolio.get('expected_return', 12) if portfolio else 12)
    
    if contract_template:
        # Use custom template with placeholder replacement
        template_text = contract_template
        replacements = {
            '{{contract_id}}': investment_id,
            '{{client_name}}': user.get('name', 'Клиент'),
            '{{client_email}}': user.get('email', ''),
            '{{portfolio_name}}': portfolio_name,
            '{{amount}}': f"{investment['amount']:,.2f}",
            '{{currency}}': investment['currency'],
            '{{duration}}': duration_label_template,
            '{{duration_value}}': str(duration_val),
            '{{duration_unit}}': duration_unit_val,
            '{{expected_return}}': f"{investment['expected_return']:,.2f}",
            '{{term_rate}}': str(term_rate_template),
            '{{annual_rate}}': str(term_rate_template),  # deprecated, keep for backwards compatibility
            '{{start_date}}': created_at.strftime('%d.%m.%Y') if isinstance(created_at, datetime) else '',
            '{{end_date}}': end_date.strftime('%d.%m.%Y') if isinstance(end_date, datetime) else '',
            '{{auto_reinvest}}': 'Да (сложный %)' if investment.get('auto_reinvest') else 'Нет',
            '{{date}}': created_at.strftime('%d.%m.%Y') if isinstance(created_at, datetime) else '',
            '{{company_name}}': company_name,
            '{{company_director}}': company_director,
            '{{company_license}}': company_license,
            '{{company_bin}}': company_bin,
        }
        
        for key, value in replacements.items():
            template_text = template_text.replace(key, str(value))
        
        # Split by paragraphs and add
        for paragraph in template_text.split('\n\n'):
            if paragraph.strip():
                stripped = paragraph.strip()
                if stripped and stripped[0].isdigit() and '.' in stripped[:5]:
                    content.append(Paragraph(f"<b>{stripped}</b>", heading_style))
                else:
                    content.append(Paragraph(stripped.replace('\n', '<br/>'), normal_style))
                content.append(Spacer(1, 5))
    else:
        # Default professional contract content
        duration_months = investment.get('duration_months', investment.get('term_months', 12))
        duration_unit = portfolio.get('duration_unit', 'months') if portfolio else 'months'
        
        # Get correct duration label with proper Russian declension
        def get_hour_suffix(n):
            if n % 10 == 1 and n % 100 != 11:
                return 'час'
            elif 2 <= n % 10 <= 4 and (n % 100 < 10 or n % 100 >= 20):
                return 'часа'
            else:
                return 'часов'
        
        def get_day_suffix(n):
            if n % 10 == 1 and n % 100 != 11:
                return 'день'
            elif 2 <= n % 10 <= 4 and (n % 100 < 10 or n % 100 >= 20):
                return 'дня'
            else:
                return 'дней'
        
        def get_month_suffix(n):
            if n % 10 == 1 and n % 100 != 11:
                return 'месяц'
            elif 2 <= n % 10 <= 4 and (n % 100 < 10 or n % 100 >= 20):
                return 'месяца'
            else:
                return 'месяцев'
        
        def get_year_suffix(n):
            if n % 10 == 1 and n % 100 != 11:
                return 'год'
            elif 2 <= n % 10 <= 4 and (n % 100 < 10 or n % 100 >= 20):
                return 'года'
            else:
                return 'лет'
        
        if duration_unit == 'hours':
            duration_label = f"{duration_months} {get_hour_suffix(duration_months)}"
        elif duration_unit == 'days':
            duration_label = f"{duration_months} {get_day_suffix(duration_months)}"
        elif duration_unit == 'years':
            duration_label = f"{duration_months} {get_year_suffix(duration_months)}"
        else:
            duration_label = f"{duration_months} {get_month_suffix(duration_months)}"
        
        # Get rate for the term
        returns_by_term = portfolio.get('returns_by_term', {}) if portfolio else {}
        term_rate = returns_by_term.get(str(duration_months), portfolio.get('expected_return', 12) if portfolio else 12)
        
        # Get payout frequency
        accrual_interval = portfolio.get('profit_accrual_interval', 'monthly') if portfolio else 'monthly'
        frequency_labels = {
            'hourly': 'ежечасно',
            'daily': 'ежедневно',
            'weekly': 'еженедельно',
            'monthly': 'ежемесячно',
            'yearly': 'ежегодно'
        }
        frequency_label = frequency_labels.get(accrual_interval, 'ежемесячно')
        
        # Calculate expected return based on auto_reinvest (compound vs simple)
        actual_expected_return = investment['expected_return']
        capitalization_note = ""
        if investment.get('auto_reinvest'):
            capitalization_note = " с капитализацией (сложный процент)"
        else:
            capitalization_note = " без капитализации (выплата на баланс)"
        
        content.append(Paragraph("<b>1. ПРЕДМЕТ ДОГОВОРА</b>", heading_style))
        content.append(Paragraph(f"""
1.1. По настоящему Договору Компания принимает от Инвестора денежные средства в размере 
<b>{investment['amount']:,.2f} {investment['currency']}</b> (далее — «Инвестиционный взнос») 
для доверительного управления и инвестирования в портфель «{portfolio_name}».
<br/><br/>
1.2. Срок инвестирования составляет <b>{duration_label}</b> 
с даты подписания настоящего Договора.
<br/><br/>
1.3. Прогнозируемая доходность по итогам срока инвестирования составляет 
<b>{actual_expected_return:,.2f} {investment['currency']}</b> 
({term_rate}% за {duration_label}).
<br/><br/>
1.4. Периодичность начисления дохода: <b>{frequency_label}</b>{capitalization_note}.
<br/><br/>
1.5. Дата окончания срока действия Договора: <b>{end_date.strftime('%d.%m.%Y') if isinstance(end_date, datetime) else 'N/A'}</b>.
<br/><br/>
1.6. По окончании срока действия Договора сумма инвестиции и начисленный доход выплачиваются на основной баланс Инвестора.
        """, normal_style))
        
        content.append(Paragraph("<b>2. ПРАВА И ОБЯЗАННОСТИ СТОРОН</b>", heading_style))
        content.append(Paragraph("""
<b>2.1. Компания обязуется:</b>
<br/>• осуществлять доверительное управление Инвестиционным взносом в интересах Инвестора;
<br/>• соблюдать инвестиционную стратегию выбранного портфеля;
<br/>• предоставлять Инвестору ежемесячную отчётность о состоянии инвестиций через Личный кабинет;
<br/>• выплатить Инвестору сумму Инвестиционного взноса и начисленный доход по окончании срока действия Договора.
<br/><br/>
<b>2.2. Инвестор подтверждает, что:</b>
<br/>• ознакомлен с инвестиционной стратегией и рисками выбранного портфеля;
<br/>• денежные средства получены законным путём и принадлежат ему на праве собственности;
<br/>• согласен с условиями настоящего Договора и Правилами оказания услуг Компании.
        """, normal_style))
        
        content.append(Paragraph("<b>3. ОТВЕТСТВЕННОСТЬ СТОРОН</b>", heading_style))
        content.append(Paragraph("""
3.1. Компания несёт ответственность за сохранность Инвестиционного взноса в пределах 
суммы страхового покрытия, установленного договором страхования профессиональной ответственности.
<br/><br/>
3.2. Инвестор понимает и принимает, что инвестиционная деятельность сопряжена с рисками, 
и прошлые результаты не гарантируют будущей доходности.
<br/><br/>
3.3. Досрочное расторжение настоящего Договора по инициативе Инвестора возможно с удержанием 
комиссии в размере, установленном действующими тарифами Компании.
        """, normal_style))
        
        content.append(Paragraph("<b>4. ПОРЯДОК РАСЧЁТОВ</b>", heading_style))
        content.append(Paragraph(f"""
4.1. Инвестиционный взнос перечисляется Инвестором на расчётный счёт Компании в течение 
3 (трёх) рабочих дней с даты подписания настоящего Договора.
<br/><br/>
4.2. Начисление дохода производится <b>{frequency_label}</b> и отражается в Личном кабинете Инвестора.
<br/><br/>
4.3. Выплата Инвестиционного взноса и начисленного дохода производится в течение 
5 (пяти) рабочих дней с даты окончания срока действия Договора на счёт, указанный Инвестором.
        """, normal_style))
        
        content.append(Paragraph("<b>5. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ</b>", heading_style))
        content.append(Paragraph(f"""
5.1. Настоящий Договор вступает в силу с момента его подписания обеими Сторонами 
и действует до полного исполнения Сторонами своих обязательств.
<br/><br/>
5.2. Договор составлен и подписан в электронной форме с использованием электронной подписи 
и имеет юридическую силу в соответствии с законодательством Республики Казахстан.
<br/><br/>
5.3. Все изменения и дополнения к настоящему Договору оформляются в письменной форме 
и подписываются уполномоченными представителями Сторон.
<br/><br/>
5.4. Все споры, возникающие из настоящего Договора, разрешаются путём переговоров, 
а при недостижении согласия — в судебном порядке по месту нахождения Компании.
        """, normal_style))
    
    content.append(Spacer(1, 25))
    
    # ===== SIGNATURES SECTION =====
    content.append(HRFlowable(width="100%", thickness=1, color=colors.black))
    content.append(Spacer(1, 15))
    content.append(Paragraph("<b>РЕКВИЗИТЫ И ПОДПИСИ СТОРОН</b>", heading_style))
    content.append(Spacer(1, 15))
    
    # Client signature data
    signature_data = investment.get('signature', '')
    signature_type = investment.get('signature_type', 'text')
    
    # Prepare company section
    company_section = f"""
<b>КОМПАНИЯ:</b><br/>
{company_name}<br/>
{company_license}<br/>
БИН: {company_bin}<br/>
{company_address}<br/><br/>
{company_director_title}:<br/>
{company_director}
"""
    
    # Prepare client section
    client_section = f"""
<b>ИНВЕСТОР:</b><br/>
{user.get('name', 'Клиент')}<br/>
Email: {user.get('email', '')}<br/>
Телефон: {user.get('phone', 'Не указан')}<br/><br/>
Дата подписания:<br/>
{created_at.strftime('%d.%m.%Y %H:%M') if isinstance(created_at, datetime) else ''}
"""
    
    # Two-column layout for parties info
    parties_data = [
        [Paragraph(company_section, normal_style), Paragraph(client_section, normal_style)]
    ]
    parties_table = Table(parties_data, colWidths=[8*cm, 8*cm])
    parties_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    content.append(parties_table)
    content.append(Spacer(1, 20))
    
    # ===== SIGNATURE AND STAMP BOXES =====
    company_sig_elements = []
    
    # Company director signature
    company_signature_base64 = admin_settings.get('company_signature')
    if company_signature_base64 and company_signature_base64.startswith('data:image'):
        try:
            base64_data = company_signature_base64.split(',')[1] if ',' in company_signature_base64 else company_signature_base64
            img_data = base64.b64decode(base64_data)
            img_buffer = io.BytesIO(img_data)
            sig_img = Image(img_buffer, width=4*cm, height=1.5*cm)
            company_sig_elements.append(sig_img)
        except Exception as e:
            company_sig_elements.append(Paragraph("_________________", center_style))
    else:
        company_sig_elements.append(Paragraph("_________________", center_style))
    
    company_sig_elements.append(Paragraph(f"<i>{company_director}</i>", ParagraphStyle('SigName', fontSize=9, fontName=FONT_REGULAR, alignment=TA_CENTER)))
    
    # Company stamp
    company_stamp_base64 = admin_settings.get('company_stamp')
    stamp_element = None
    if company_stamp_base64 and company_stamp_base64.startswith('data:image'):
        try:
            base64_data = company_stamp_base64.split(',')[1] if ',' in company_stamp_base64 else company_stamp_base64
            img_data = base64.b64decode(base64_data)
            img_buffer = io.BytesIO(img_data)
            stamp_element = Image(img_buffer, width=3*cm, height=3*cm)
        except:
            stamp_element = Paragraph("М.П.", center_style)
    else:
        stamp_element = Paragraph("М.П.", ParagraphStyle('StampPlaceholder', fontSize=12, fontName=FONT_REGULAR, alignment=TA_CENTER, textColor=colors.gray))
    
    # Client signature
    client_sig_elements = []
    if signature_type == 'canvas' and signature_data and signature_data.startswith('data:image'):
        try:
            base64_data = signature_data.split(',')[1] if ',' in signature_data else signature_data
            img_data = base64.b64decode(base64_data)
            img_buffer = io.BytesIO(img_data)
            client_sig_img = Image(img_buffer, width=5*cm, height=2*cm)
            client_sig_elements.append(client_sig_img)
        except Exception as e:
            client_sig_elements.append(Paragraph(f"<i>{signature_data[:30]}...</i>", center_style))
    else:
        client_sig_elements.append(Paragraph(f"<i>{signature_data}</i>", ParagraphStyle('ClientSig', fontSize=14, fontName=FONT_REGULAR, alignment=TA_CENTER)))
    
    client_sig_elements.append(Paragraph(f"<i>{user.get('name', 'Клиент')}</i>", ParagraphStyle('SigName', fontSize=9, fontName=FONT_REGULAR, alignment=TA_CENTER)))
    
    # Build signature boxes table
    company_sig_box = Table(
        [[el] for el in company_sig_elements],
        colWidths=[5*cm]
    )
    company_sig_box.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    stamp_box = Table(
        [[stamp_element]],
        colWidths=[3.5*cm], rowHeights=[3.5*cm]
    )
    stamp_box.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.gray) if not company_stamp_base64 else ('BOX', (0, 0), (-1, -1), 0, colors.white),
    ]))
    
    client_sig_box = Table(
        [[el] for el in client_sig_elements],
        colWidths=[6*cm]
    )
    client_sig_box.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#0d4a4a')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fafafa')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    
    # Final signature table layout
    sig_table_data = [
        [Paragraph("<b>Подпись Компании:</b>", small_style), Paragraph("<b>Печать:</b>", small_style), Paragraph("<b>Подпись Инвестора:</b>", small_style)],
        [company_sig_box, stamp_box, client_sig_box]
    ]
    
    final_sig_table = Table(sig_table_data, colWidths=[5.5*cm, 4*cm, 6.5*cm])
    final_sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    content.append(final_sig_table)
    
    content.append(Spacer(1, 20))
    
    # ===== FOOTER =====
    content.append(HRFlowable(width="100%", thickness=0.5, color=colors.gray))
    content.append(Spacer(1, 5))
    
    footer_text = f"""Дата и время подписания: {created_at.strftime('%d.%m.%Y %H:%M:%S UTC') if isinstance(created_at, datetime) else ''}
Идентификатор договора: {investment_id}
Тип электронной подписи: {signature_type.upper()}

{company_name} | {company_license} | БИН {company_bin} | {support_email}"""
    footer_style = ParagraphStyle('Footer', fontSize=8, textColor=colors.gray, alignment=TA_CENTER, fontName=FONT_REGULAR, leading=10)
    content.append(Paragraph(footer_text.replace('\n', '<br/>'), footer_style))
    
    # Build PDF
    doc.build(content)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=contract_{investment_id}.pdf"}
    )


# ==================== CONTRACT TEMPLATES ====================

@router.get("/admin/contract-templates")
async def admin_get_contract_templates(request: Request):
    """Get all contract templates"""
    await get_admin_user(request)
    templates = await db.contract_templates.find({}, {"_id": 0}).to_list(100)
    return templates


@router.post("/admin/contract-templates")
async def admin_create_contract_template(request: Request):
    """Create a new contract template"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    template = {
        "template_id": f"tmpl_{uuid.uuid4().hex[:8]}",
        "name": body.get("name"),
        "description": body.get("description", ""),
        "content": body.get("content", {"ru": "", "en": "", "tr": ""}),
        "is_default": body.get("is_default", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If setting as default, unset other defaults
    if template["is_default"]:
        await db.contract_templates.update_many({}, {"$set": {"is_default": False}})
    
    await db.contract_templates.insert_one(template)
    
    return {"message": "Template created", "template_id": template["template_id"]}


@router.get("/admin/contract-templates/{template_id}")
async def admin_get_contract_template(template_id: str, request: Request):
    """Get a specific contract template"""
    await get_admin_user(request)
    template = await db.contract_templates.find_one({"template_id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.put("/admin/contract-templates/{template_id}")
async def admin_update_contract_template(template_id: str, request: Request):
    """Update a contract template"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    # If setting as default, unset other defaults
    if body.get("is_default"):
        await db.contract_templates.update_many(
            {"template_id": {"$ne": template_id}},
            {"$set": {"is_default": False}}
        )
    
    update_data = {k: v for k, v in body.items() if k != "template_id"}
    
    await db.contract_templates.update_one(
        {"template_id": template_id},
        {"$set": update_data}
    )
    
    return {"message": "Template updated"}


@router.delete("/admin/contract-templates/{template_id}")
async def admin_delete_contract_template(template_id: str, request: Request):
    """Delete a contract template"""
    await get_admin_user(request)
    await db.contract_templates.delete_one({"template_id": template_id})
    return {"message": "Template deleted"}


@router.get("/admin/contract-templates/{template_id}/preview")
async def admin_preview_contract_template(template_id: str, request: Request):
    """Generate a preview PDF of a contract template with sample data"""
    await get_admin_user(request)
    
    template = await db.contract_templates.find_one({"template_id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Sample data for preview
    sample_data = {
        "{{contract_id}}": "INV_PREVIEW_001",
        "{{client_name}}": "Иванов Иван Иванович",
        "{{client_email}}": "ivanov@example.com",
        "{{portfolio_name}}": "Стабильный доход",
        "{{amount}}": "100,000.00",
        "{{currency}}": "USD",
        "{{duration}}": "12",
        "{{expected_return}}": "12,000.00",
        "{{annual_rate}}": "12",
        "{{start_date}}": datetime.now().strftime('%d.%m.%Y'),
        "{{end_date}}": (datetime.now() + timedelta(days=365)).strftime('%d.%m.%Y'),
        "{{auto_reinvest}}": "Нет",
        "{{date}}": datetime.now().strftime('%d.%m.%Y'),
        "{{company_name}}": "Phillip Capital Invest LLP",
        "{{company_director}}": "Иванов И.И.",
        "{{company_license}}": "Лицензия НБ РК №1.2.34/567",
        "{{company_bin}}": "123456789012",
    }
    
    # Register DejaVuSans font
    try:
        pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
        FONT_NAME = 'DejaVuSans'
        FONT_BOLD = 'DejaVuSans-Bold'
    except:
        FONT_NAME = 'Helvetica'
        FONT_BOLD = 'Helvetica-Bold'
    
    # Create preview PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    
    content_text = template["content"].get("ru", "")
    for key, value in sample_data.items():
        content_text = content_text.replace(key, value)
    
    # Create styles with Cyrillic font
    preview_style = ParagraphStyle('Preview', fontSize=14, alignment=TA_CENTER, textColor=colors.red, fontName=FONT_BOLD, leading=18)
    normal_style = ParagraphStyle('Normal', fontSize=10, fontName=FONT_NAME, leading=14)
    heading_style = ParagraphStyle('Heading', fontSize=11, fontName=FONT_BOLD, leading=14, spaceBefore=10, spaceAfter=6)
    
    pdf_content = []
    pdf_content.append(Paragraph("ПРЕДПРОСМОТР ШАБЛОНА ДОГОВОРА", preview_style))
    pdf_content.append(Spacer(1, 20))
    
    for para in content_text.split('\n\n'):
        if para.strip():
            stripped = para.strip()
            if stripped and stripped[0].isdigit() and '.' in stripped[:5]:
                pdf_content.append(Paragraph(stripped.replace('\n', '<br/>'), heading_style))
            else:
                pdf_content.append(Paragraph(stripped.replace('\n', '<br/>'), normal_style))
            pdf_content.append(Spacer(1, 8))
    
    doc.build(pdf_content)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=template_preview_{template_id}.pdf"}
    )
