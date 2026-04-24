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
    
    # Language priority (explicit UI language wins):
    # 1. ?lang=xx query param (from current website UI)
    # 2. Accept-Language header
    # 3. User's saved preferred_language in profile
    # 4. Fallback to Russian
    SUPPORTED = {"tr", "ru", "en"}
    lang = None
    try:
        qp = request.query_params.get("lang")
        if qp and qp.lower() in SUPPORTED:
            lang = qp.lower()
    except Exception:
        lang = None
    if not lang:
        accept_lang = (request.headers.get("accept-language") or "").lower()
        for code in ("tr", "ru", "en"):
            if code in accept_lang:
                lang = code
                break
    if not lang:
        profile_lang = (user.get("preferred_language") or "").lower()
        if profile_lang in SUPPORTED:
            lang = profile_lang
    if not lang:
        lang = "ru"
    
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
    
    # Localized header strings (TR / RU / EN)
    L = {
        'tr': {
            'title': 'YATIRIM SÖZLEŞMESİ',
            'intro': '<b>{company}</b>, {dir_title} {director} tarafından Ana Sözleşme uyarınca temsil edilen, bundan böyle "Şirket" olarak anılacak olan, bir taraftan, ve'
                     '<br/><br/>Bay/Bayan <b>{name}</b>, bundan böyle "Yatırımcı" olarak anılacak olan, diğer taraftan, birlikte "Taraflar" olarak anılacak olup, işbu Sözleşmeyi aşağıdaki şartlarla akdetmişlerdir:',
            'client_fallback': 'Müşteri',
        },
        'ru': {
            'title': 'ИНВЕСТИЦИОННЫЙ ДОГОВОР',
            'intro': '<b>{company}</b>, в лице {dir_title} {director}, действующего на основании Устава, именуемое в дальнейшем «Компания», с одной стороны, и'
                     '<br/><br/>Гражданин(ка) <b>{name}</b>, именуемый(ая) в дальнейшем «Инвестор», с другой стороны, совместно именуемые «Стороны», заключили настоящий Договор о нижеследующем:',
            'client_fallback': 'Клиент',
        },
        'en': {
            'title': 'INVESTMENT AGREEMENT',
            'intro': '<b>{company}</b>, represented by {dir_title} {director} acting on the basis of the Charter, hereinafter referred to as the "Company", on the one side, and'
                     '<br/><br/>Mr./Ms. <b>{name}</b>, hereinafter referred to as the "Investor", on the other side, collectively referred to as the "Parties", have entered into this Agreement on the following terms:',
            'client_fallback': 'Client',
        },
    }
    Lx = L.get(lang, L['en'])
    
    content.append(Paragraph(Lx['title'], subtitle_style))
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
    
    # ===== PARTIES INTRODUCTION (localized) =====
    intro_text = Lx['intro'].format(
        company=company_name,
        dir_title=company_director_title,
        director=company_director,
        name=user.get('name', Lx['client_fallback'])
    )
    content.append(Paragraph(intro_text, normal_style))
    content.append(Spacer(1, 10))
    
    # Check if portfolio has custom contract template for THIS specific language.
    # If the user's preferred language version is missing (e.g. portfolio has only RU
    # custom template but user picked TR), we DON'T fall back to the other language's
    # custom template — instead we use the built-in localized default contract body
    # below. This guarantees the contract is in the user's language.
    portfolio_templates = portfolio.get('contract_template', {}) if portfolio else {}
    contract_template = portfolio_templates.get(lang, '') or ''
    
    # Prepare duration label for templates (language-aware)
    duration_val = investment.get('duration_months', investment.get('term_months', 12))
    duration_unit_val = portfolio.get('duration_unit', 'months') if portfolio else 'months'
    unit_labels = {
        'tr': {'hours': 's.', 'days': 'gün', 'months': 'ay', 'years': 'yıl'},
        'ru': {'hours': 'ч.', 'days': 'дн.', 'months': 'мес.', 'years': 'г.'},
        'en': {'hours': 'h', 'days': 'd', 'months': 'mo.', 'years': 'y'},
    }
    unit_label = unit_labels.get(lang, unit_labels['en']).get(duration_unit_val, unit_labels.get(lang, unit_labels['en'])['months'])
    duration_label_template = f"{duration_val} {unit_label}"
    
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
        
        # Override duration_label for non-Russian languages (simpler plural form)
        if lang != 'ru':
            simple_unit = {
                'tr': {'hours': 'saat', 'days': 'gün', 'months': 'ay', 'years': 'yıl'},
                'en': {'hours': 'hours', 'days': 'days', 'months': 'months', 'years': 'years'},
            }.get(lang, {'hours': 'hours', 'days': 'days', 'months': 'months', 'years': 'years'})
            duration_label = f"{duration_months} {simple_unit.get(duration_unit, simple_unit['months'])}"
        
        # Localized default contract body (TR / RU / EN)
        frequency_labels_all = {
            'tr': {'hourly': 'saatlik', 'daily': 'günlük', 'weekly': 'haftalık', 'monthly': 'aylık', 'yearly': 'yıllık'},
            'ru': {'hourly': 'ежечасно', 'daily': 'ежедневно', 'weekly': 'еженедельно', 'monthly': 'ежемесячно', 'yearly': 'ежегодно'},
            'en': {'hourly': 'hourly', 'daily': 'daily', 'weekly': 'weekly', 'monthly': 'monthly', 'yearly': 'yearly'},
        }
        freq_set = frequency_labels_all.get(lang, frequency_labels_all['en'])
        frequency_label = freq_set.get(accrual_interval, freq_set['monthly'])
        
        cap_notes_all = {
            'tr': (' kapitalizasyon ile (bileşik faiz)', ' kapitalizasyon olmadan (bakiyeye ödeme)'),
            'ru': (' с капитализацией (сложный процент)', ' без капитализации (выплата на баланс)'),
            'en': (' with capitalization (compound interest)', ' without capitalization (paid to balance)'),
        }
        cap_auto, cap_none = cap_notes_all.get(lang, cap_notes_all['en'])
        capitalization_note = cap_auto if investment.get('auto_reinvest') else cap_none
        
        end_date_str = end_date.strftime('%d.%m.%Y') if isinstance(end_date, datetime) else 'N/A'
        amount_str = f"{investment['amount']:,.2f} {investment['currency']}"
        expected_str = f"{actual_expected_return:,.2f} {investment['currency']}"
        
        SECTIONS = {
            'tr': {
                'h1': '<b>1. SÖZLEŞMENİN KONUSU</b>',
                's1': f"""1.1. İşbu Sözleşme kapsamında Şirket, Yatırımcıdan <b>{amount_str}</b> tutarında nakit (bundan böyle "Yatırım Tutarı") alır ve bu tutarı «{portfolio_name}» portföyü kapsamında güvene dayalı olarak yönetir.
<br/><br/>1.2. Yatırım süresi, işbu Sözleşmenin imzalanma tarihinden itibaren <b>{duration_label}</b>'dır.
<br/><br/>1.3. Yatırım süresi sonunda öngörülen getiri <b>{expected_str}</b>'dır ({term_rate}% / {duration_label}).
<br/><br/>1.4. Gelir tahakkuk sıklığı: <b>{frequency_label}</b>{capitalization_note}.
<br/><br/>1.5. Sözleşmenin sona erme tarihi: <b>{end_date_str}</b>.
<br/><br/>1.6. Sözleşme süresi sonunda yatırım tutarı ve tahakkuk eden gelir Yatırımcının ana bakiyesine ödenir.""",
                'h2': '<b>2. TARAFLARIN HAKLARI VE YÜKÜMLÜLÜKLERİ</b>',
                's2': """<b>2.1. Şirket taahhüt eder:</b>
<br/>• Yatırımcının menfaati doğrultusunda Yatırım Tutarının güvene dayalı yönetimini gerçekleştirmeyi;
<br/>• Seçilen portföyün yatırım stratejisine uymayı;
<br/>• Hesabım aracılığıyla Yatırımcıya aylık raporlama sağlamayı;
<br/>• Sözleşme sonunda Yatırım Tutarını ve tahakkuk eden geliri Yatırımcıya ödemeyi.
<br/><br/><b>2.2. Yatırımcı beyan eder:</b>
<br/>• Seçilen portföyün yatırım stratejisi ve riskleri hakkında bilgi sahibi olduğunu;
<br/>• Fonların yasal yollarla elde edildiğini ve mülkiyetinin kendisine ait olduğunu;
<br/>• İşbu Sözleşmenin ve Şirketin Hizmet Kurallarının şartlarını kabul ettiğini.""",
                'h3': '<b>3. TARAFLARIN SORUMLULUĞU</b>',
                's3': """3.1. Şirket, profesyonel sorumluluk sigorta sözleşmesi ile belirlenen sigorta teminat tutarı dahilinde Yatırım Tutarının güvenliğinden sorumludur.
<br/><br/>3.2. Yatırımcı, yatırım faaliyetinin risk içerdiğini ve geçmiş sonuçların gelecekteki getirileri garanti etmediğini anlar ve kabul eder.
<br/><br/>3.3. Yatırımcının inisiyatifi ile Sözleşmenin erken feshi, Şirketin yürürlükteki tarifelerinde belirlenen tutarda komisyon kesintisi ile mümkündür.""",
                'h4': '<b>4. ÖDEME DÜZENİ</b>',
                's4': f"""4.1. Yatırım Tutarı, işbu Sözleşmenin imzalanma tarihinden itibaren 3 (üç) iş günü içinde Yatırımcı tarafından Şirketin hesabına aktarılır.
<br/><br/>4.2. Gelir tahakkuku <b>{frequency_label}</b> yapılır ve Yatırımcının Hesabımda görüntülenir.
<br/><br/>4.3. Yatırım Tutarı ve tahakkuk eden gelir, Sözleşmenin sona erme tarihinden itibaren 5 (beş) iş günü içinde Yatırımcının belirttiği hesaba ödenir.""",
                'h5': '<b>5. SON HÜKÜMLER</b>',
                's5': """5.1. İşbu Sözleşme, her iki Tarafça imzalanmasıyla yürürlüğe girer ve Tarafların yükümlülüklerini tam olarak yerine getirinceye kadar geçerlidir.
<br/><br/>5.2. Sözleşme, elektronik imza kullanılarak elektronik biçimde düzenlenmiş ve imzalanmıştır ve yürürlükteki mevzuat uyarınca hukuki geçerliliğe sahiptir.
<br/><br/>5.3. İşbu Sözleşmedeki tüm değişiklikler ve eklemeler yazılı olarak yapılır ve Tarafların yetkili temsilcileri tarafından imzalanır.
<br/><br/>5.4. İşbu Sözleşmeden doğan tüm anlaşmazlıklar müzakere yoluyla çözülür, anlaşmaya varılamazsa Şirketin bulunduğu yerdeki mahkemelerde yargı yoluyla çözülür.""",
            },
            'ru': {
                'h1': '<b>1. ПРЕДМЕТ ДОГОВОРА</b>',
                's1': f"""1.1. По настоящему Договору Компания принимает от Инвестора денежные средства в размере <b>{amount_str}</b> (далее — «Инвестиционный взнос») для доверительного управления и инвестирования в портфель «{portfolio_name}».
<br/><br/>1.2. Срок инвестирования составляет <b>{duration_label}</b> с даты подписания настоящего Договора.
<br/><br/>1.3. Прогнозируемая доходность по итогам срока инвестирования составляет <b>{expected_str}</b> ({term_rate}% за {duration_label}).
<br/><br/>1.4. Периодичность начисления дохода: <b>{frequency_label}</b>{capitalization_note}.
<br/><br/>1.5. Дата окончания срока действия Договора: <b>{end_date_str}</b>.
<br/><br/>1.6. По окончании срока действия Договора сумма инвестиции и начисленный доход выплачиваются на основной баланс Инвестора.""",
                'h2': '<b>2. ПРАВА И ОБЯЗАННОСТИ СТОРОН</b>',
                's2': """<b>2.1. Компания обязуется:</b>
<br/>• осуществлять доверительное управление Инвестиционным взносом в интересах Инвестора;
<br/>• соблюдать инвестиционную стратегию выбранного портфеля;
<br/>• предоставлять Инвестору ежемесячную отчётность о состоянии инвестиций через Личный кабинет;
<br/>• выплатить Инвестору сумму Инвестиционного взноса и начисленный доход по окончании срока действия Договора.
<br/><br/><b>2.2. Инвестор подтверждает, что:</b>
<br/>• ознакомлен с инвестиционной стратегией и рисками выбранного портфеля;
<br/>• денежные средства получены законным путём и принадлежат ему на праве собственности;
<br/>• согласен с условиями настоящего Договора и Правилами оказания услуг Компании.""",
                'h3': '<b>3. ОТВЕТСТВЕННОСТЬ СТОРОН</b>',
                's3': """3.1. Компания несёт ответственность за сохранность Инвестиционного взноса в пределах суммы страхового покрытия, установленного договором страхования профессиональной ответственности.
<br/><br/>3.2. Инвестор понимает и принимает, что инвестиционная деятельность сопряжена с рисками, и прошлые результаты не гарантируют будущей доходности.
<br/><br/>3.3. Досрочное расторжение настоящего Договора по инициативе Инвестора возможно с удержанием комиссии в размере, установленном действующими тарифами Компании.""",
                'h4': '<b>4. ПОРЯДОК РАСЧЁТОВ</b>',
                's4': f"""4.1. Инвестиционный взнос перечисляется Инвестором на расчётный счёт Компании в течение 3 (трёх) рабочих дней с даты подписания настоящего Договора.
<br/><br/>4.2. Начисление дохода производится <b>{frequency_label}</b> и отражается в Личном кабинете Инвестора.
<br/><br/>4.3. Выплата Инвестиционного взноса и начисленного дохода производится в течение 5 (пяти) рабочих дней с даты окончания срока действия Договора на счёт, указанный Инвестором.""",
                'h5': '<b>5. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ</b>',
                's5': """5.1. Настоящий Договор вступает в силу с момента его подписания обеими Сторонами и действует до полного исполнения Сторонами своих обязательств.
<br/><br/>5.2. Договор составлен и подписан в электронной форме с использованием электронной подписи и имеет юридическую силу в соответствии с действующим законодательством.
<br/><br/>5.3. Все изменения и дополнения к настоящему Договору оформляются в письменной форме и подписываются уполномоченными представителями Сторон.
<br/><br/>5.4. Все споры, возникающие из настоящего Договора, разрешаются путём переговоров, а при недостижении согласия — в судебном порядке по месту нахождения Компании.""",
            },
            'en': {
                'h1': '<b>1. SUBJECT MATTER OF THE AGREEMENT</b>',
                's1': f"""1.1. Under this Agreement, the Company accepts from the Investor funds in the amount of <b>{amount_str}</b> (hereinafter - the "Investment Contribution") for trust management and investment in the «{portfolio_name}» portfolio.
<br/><br/>1.2. The investment term is <b>{duration_label}</b> from the date of signing this Agreement.
<br/><br/>1.3. The projected return at the end of the investment term is <b>{expected_str}</b> ({term_rate}% per {duration_label}).
<br/><br/>1.4. Income accrual frequency: <b>{frequency_label}</b>{capitalization_note}.
<br/><br/>1.5. Agreement expiration date: <b>{end_date_str}</b>.
<br/><br/>1.6. Upon expiration of the Agreement, the investment amount and accrued income are paid to the Investor's main balance.""",
                'h2': '<b>2. RIGHTS AND OBLIGATIONS OF THE PARTIES</b>',
                's2': """<b>2.1. The Company undertakes to:</b>
<br/>• carry out trust management of the Investment Contribution in the interests of the Investor;
<br/>• comply with the investment strategy of the selected portfolio;
<br/>• provide the Investor with monthly reports on the state of investments through the Personal Account;
<br/>• pay to the Investor the Investment Contribution amount and accrued income upon expiration of the Agreement.
<br/><br/><b>2.2. The Investor confirms that:</b>
<br/>• is familiar with the investment strategy and risks of the selected portfolio;
<br/>• the funds were obtained legally and belong to him/her by right of ownership;
<br/>• agrees to the terms of this Agreement and the Company's Service Rules.""",
                'h3': '<b>3. LIABILITY OF THE PARTIES</b>',
                's3': """3.1. The Company is responsible for the safety of the Investment Contribution within the amount of insurance coverage established by the professional liability insurance agreement.
<br/><br/>3.2. The Investor understands and accepts that investment activity is associated with risks, and past results do not guarantee future returns.
<br/><br/>3.3. Early termination of this Agreement at the initiative of the Investor is possible with deduction of a commission in the amount established by the Company's current tariffs.""",
                'h4': '<b>4. PAYMENT PROCEDURE</b>',
                's4': f"""4.1. The Investment Contribution is transferred by the Investor to the Company's account within 3 (three) business days from the date of signing this Agreement.
<br/><br/>4.2. Income accrual is made <b>{frequency_label}</b> and is reflected in the Investor's Personal Account.
<br/><br/>4.3. Payment of the Investment Contribution and accrued income is made within 5 (five) business days from the Agreement's expiration date to the account specified by the Investor.""",
                'h5': '<b>5. FINAL PROVISIONS</b>',
                's5': """5.1. This Agreement enters into force from the moment of its signing by both Parties and is valid until the Parties fully fulfill their obligations.
<br/><br/>5.2. The Agreement is drawn up and signed in electronic form using electronic signature and has legal force in accordance with applicable law.
<br/><br/>5.3. All changes and additions to this Agreement are made in writing and signed by authorized representatives of the Parties.
<br/><br/>5.4. All disputes arising from this Agreement are resolved through negotiations, and if no agreement is reached — through judicial proceedings at the location of the Company.""",
            },
        }
        sec = SECTIONS.get(lang, SECTIONS['en'])
        content.append(Paragraph(sec['h1'], heading_style))
        content.append(Paragraph(sec['s1'], normal_style))
        content.append(Paragraph(sec['h2'], heading_style))
        content.append(Paragraph(sec['s2'], normal_style))
        content.append(Paragraph(sec['h3'], heading_style))
        content.append(Paragraph(sec['s3'], normal_style))
        content.append(Paragraph(sec['h4'], heading_style))
        content.append(Paragraph(sec['s4'], normal_style))
        content.append(Paragraph(sec['h5'], heading_style))
        content.append(Paragraph(sec['s5'], normal_style))
    
    content.append(Spacer(1, 25))
    
    # ===== SIGNATURES SECTION =====
    content.append(HRFlowable(width="100%", thickness=1, color=colors.black))
    content.append(Spacer(1, 15))
    
    sig_headers = {
        'tr': 'TARAFLARIN KAYITLARI VE İMZALARI',
        'ru': 'РЕКВИЗИТЫ И ПОДПИСИ СТОРОН',
        'en': 'PARTIES DETAILS AND SIGNATURES',
    }
    content.append(Paragraph(f"<b>{sig_headers.get(lang, sig_headers['en'])}</b>", heading_style))
    content.append(Spacer(1, 15))
    
    # Client signature data
    signature_data = investment.get('signature', '')
    signature_type = investment.get('signature_type', 'text')
    
    # Localized labels
    sig_labels = {
        'tr': {'company': 'ŞİRKET', 'investor': 'YATIRIMCI', 'bin': 'Vergi No', 'phone': 'Telefon', 'not_specified': 'Belirtilmedi', 'sign_date': 'İmza tarihi', 'client_fallback': 'Müşteri'},
        'ru': {'company': 'КОМПАНИЯ', 'investor': 'ИНВЕСТОР', 'bin': 'БИН', 'phone': 'Телефон', 'not_specified': 'Не указан', 'sign_date': 'Дата подписания', 'client_fallback': 'Клиент'},
        'en': {'company': 'COMPANY', 'investor': 'INVESTOR', 'bin': 'Reg.No', 'phone': 'Phone', 'not_specified': 'Not specified', 'sign_date': 'Signing date', 'client_fallback': 'Client'},
    }
    SL = sig_labels.get(lang, sig_labels['en'])
    
    # Prepare company section
    company_section = f"""
<b>{SL['company']}:</b><br/>
{company_name}<br/>
{company_license}<br/>
{SL['bin']}: {company_bin}<br/>
{company_address}<br/><br/>
{company_director_title}:<br/>
{company_director}
"""
    
    # Prepare client section
    client_section = f"""
<b>{SL['investor']}:</b><br/>
{user.get('name', SL['client_fallback'])}<br/>
Email: {user.get('email', '')}<br/>
{SL['phone']}: {user.get('phone', SL['not_specified'])}<br/><br/>
{SL['sign_date']}:<br/>
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
    
    # Company stamp (M.P. / Mühür)
    stamp_text = {'tr': 'MÜHÜR', 'ru': 'М.П.', 'en': 'L.S.'}.get(lang, 'L.S.')
    company_stamp_base64 = admin_settings.get('company_stamp')
    stamp_element = None
    if company_stamp_base64 and company_stamp_base64.startswith('data:image'):
        try:
            base64_data = company_stamp_base64.split(',')[1] if ',' in company_stamp_base64 else company_stamp_base64
            img_data = base64.b64decode(base64_data)
            img_buffer = io.BytesIO(img_data)
            stamp_element = Image(img_buffer, width=3*cm, height=3*cm)
        except:
            stamp_element = Paragraph(stamp_text, center_style)
    else:
        stamp_element = Paragraph(stamp_text, ParagraphStyle('StampPlaceholder', fontSize=12, fontName=FONT_REGULAR, alignment=TA_CENTER, textColor=colors.gray))
    
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
    
    client_sig_elements.append(Paragraph(f"<i>{user.get('name', SL['client_fallback'])}</i>", ParagraphStyle('SigName', fontSize=9, fontName=FONT_REGULAR, alignment=TA_CENTER)))
    
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
    
    # Final signature table layout (localized column headers)
    col_headers = {
        'tr': ('Şirket İmzası', 'Mühür', 'Yatırımcı İmzası'),
        'ru': ('Подпись Компании', 'Печать', 'Подпись Инвестора'),
        'en': ('Company Signature', 'Stamp', 'Investor Signature'),
    }
    ch = col_headers.get(lang, col_headers['en'])
    sig_table_data = [
        [Paragraph(f"<b>{ch[0]}:</b>", small_style), Paragraph(f"<b>{ch[1]}:</b>", small_style), Paragraph(f"<b>{ch[2]}:</b>", small_style)],
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
    
    # ===== FOOTER (localized) =====
    content.append(HRFlowable(width="100%", thickness=0.5, color=colors.gray))
    content.append(Spacer(1, 5))
    
    footer_labels = {
        'tr': ('İmza tarih ve saati', 'Sözleşme ID', 'Elektronik imza türü', 'Vergi No'),
        'ru': ('Дата и время подписания', 'Идентификатор договора', 'Тип электронной подписи', 'БИН'),
        'en': ('Signing date and time', 'Contract ID', 'Electronic signature type', 'Reg.No'),
    }
    fl = footer_labels.get(lang, footer_labels['en'])
    footer_text = (
        f"{fl[0]}: {created_at.strftime('%d.%m.%Y %H:%M:%S UTC') if isinstance(created_at, datetime) else ''}\n"
        f"{fl[1]}: {investment_id}\n"
        f"{fl[2]}: {signature_type.upper()}\n"
        f"\n{company_name} | {company_license} | {fl[3]} {company_bin} | {support_email}"
    )
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
