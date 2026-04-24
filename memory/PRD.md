# AltynContract - PRD (Product Requirements Document)

## Latest Updates (January 28, 2026)

### Investment Logic Refactoring (P0) - ✅ COMPLETE (Session 2, Part 3)
**Новая логика начисления прибыли:**

| Событие | Капитализация ВКЛ | Капитализация ВЫКЛ |
|---------|-------------------|---------------------|
| **Во время срока** | Прибыль → к балансу инвестиции (сложный %) | Прибыль → на available_balance (выплата) |
| **По окончании срока** | current_balance → available_balance | amount → available_balance |

**Что реализовано:**
1. Изменена логика в `server.py:run_profit_accrual()` - проверка end_date и выплата при завершении
2. Добавлено отображение "Частота начисления" в:
   - Карточки портфелей (desktop + mobile)
   - Шаг 1 формы инвестирования (desktop + mobile)
   - Шаг 2 подтверждения (desktop + mobile)
3. PDF контракт обновлён:
   - Пункт 1.4: "Периодичность начисления дохода: **ежемесячно** с капитализацией (сложный процент)" или "без капитализации (выплата на баланс)"
   - Пункт 1.6: "По окончании срока ... выплачиваются на основной баланс Инвестора"
   - Пункт 4.2: Начисление дохода производится **{frequency}**
4. Переименовано "Авто-реинвест" → "Капитализация"

### Currency Display Overhaul (P0) - ✅ COMPLETE (Session 2, Part 2)
- **Removed currency selector** from investment forms - all investments now in USD
- **Fixed balance display bug** - balance now correctly converts from USD to user's preferred currency
- **Added USD with equivalent** - when user's currency ≠ USD, shows "$X.XX (~₸Y)" format

### Email PDF Attachment Fix (P0) - ✅ COMPLETE (Session 2, Part 1)
- Fixed PDF generation in `contract_generator.py` to use correct duration_unit and term_rate

### Investment Logic Overhaul (P0) - ✅ COMPLETE (Session 1)
1. Compound interest implementation
2. Investment calculator updates
3. Editable portfolio statistics for admin
4. Term-based rates instead of annual

### Key Code Changes:
- `backend/server.py`: **MAJOR UPDATE** - contract completion logic, payout to available_balance
- `backend/services/contract_generator.py`: Added frequency_label and payout text
- `backend/routers/contracts.py`: Added frequency_label and payout text
- `frontend/src/i18n/LanguageContext.js`: Added `formatUsdWithEquivalent()`
- `frontend/InvestPage.js`: Added payout frequency display, renamed to "Капитализация"
- `frontend/MobileInvestWizard.js`: Added payout frequency display
- `frontend/PortfoliosPage.js`: Added "Начисление" row in portfolio cards
- `frontend/MobilePortfolios.js`: Added "Начисление" row

### Pending Issues:
- **P1: iOS Mobile Bottom Navigation Bar** - Still disappears on scroll (requires iOS-specific CSS fix)

---

## Original Problem Statement
Спроектировать архитектуру и интерфейс сайта AltynContract для Tier-1 инвесторов премиум-класса с системой аккаунтов, двойным балансом, KYC верификацией, инвестиционным циклом, личным кабинетом премиум класса, админ-панелью и генерацией PDF контрактов.

## User Personas
1. **Premium Investor (Tier-1)** - VIP клиент с крупными суммами инвестиций
2. **Regular Investor** - Начинающий инвестор
3. **Platform Admin** - Администратор платформы

## Core Requirements (Static)
- Multi-language support: RU, KZ, EN
- Multi-currency: USD, KZT, EUR, USDT
- Authentication: Email, Google OAuth (Emergent), Telegram (placeholder)
- Dual balance: Available + Portfolio
- KYC/AML verification workflow
- Investment lifecycle with e-signature
- Loyalty tiers: Silver, Gold, Platinum
- Full admin panel with complete client management

## Architecture
- **Frontend**: React 18 + TailwindCSS + Shadcn/UI + Recharts
- **Backend**: FastAPI + Motor (MongoDB async) + APScheduler
- **Database**: MongoDB
- **Auth**: Emergent Google OAuth + Email/Password
- **PDF**: ReportLab with DejaVuSans (Cyrillic support)
- **Translations**: Gemini API (via Emergent)
- **Currency Rates**: exchangerate-api.com
- **Scheduler**: APScheduler (AsyncIOScheduler) for automatic profit accrual

## What's Been Implemented (January 2026)

### Backend API (/app/backend/server.py)
- [x] User authentication (register, login, logout, OAuth session)
- [x] User management (settings, deposit, withdraw, transactions)
- [x] Portfolio CRUD (public listing, details)
- [x] Investment creation with e-signature (canvas)
- [x] PDF Contract generation with DejaVuSans font (Cyrillic support)
- [x] KYC document upload and status
- [x] Support tickets system
- [x] Admin dashboard stats
- [x] Admin user management
- [x] Admin portfolio CRUD with durations and rates
- [x] Admin KYC review
- [x] Admin withdrawal/deposit request processing
- [x] Admin ticket responses
- [x] Admin audit logs
- [x] Admin email campaigns
- [x] Admin contract templates with auto-translation (Gemini)
- [x] Admin company settings (signature/stamp upload)
- [x] Profit accrual logic (reinvest vs payout)
- [x] Client account number (AC-xxxxxxxx format)
- [x] Currency exchange rates API
- [x] **APScheduler for automatic profit accrual (hourly)**
- [x] **Scheduler status API (GET /api/scheduler/status)**
- [x] **Manual profit accrual trigger (POST /api/scheduler/run-now)**
- [x] **Profit analytics API (GET /api/user/profit-analytics)**

### Frontend Pages
- [x] Landing page (premium design)
- [x] Login/Register pages
- [x] Dashboard with real profit charts (PnL, asset distribution)
- [x] Portfolios catalog with annual/monthly yields
- [x] Investment flow (4 steps with canvas e-signature)
- [x] Wallet page (deposit/withdrawal with account_number)
- [x] Transaction/Contract history with detailed descriptions
- [x] Support tickets
- [x] Settings (profile, language, currency, KYC)
- [x] Admin panel (all sections)
- [x] Admin portfolio form with profit calculator
- [x] **Admin dashboard with scheduler status card**

### Features Completed (January 23, 2026)
- [x] Removed language/currency switchers from Header (moved to Settings)
- [x] Client account_number shown in deposit modals
- [x] Transaction history shows "Доход" for income/profit types
- [x] Portfolio cards show annual yield + per-period yield
- [x] Admin profit calculator in portfolio form
- [x] PDF contract generation works with Cyrillic fonts
- [x] **APScheduler runs profit accrual every hour at minute 0**
- [x] **Admin can view scheduler status and manually trigger accrual**
- [x] **Dashboard profit chart uses real data from profit-analytics API**

### Integrations
- [x] Emergent Google OAuth - WORKING
- [x] Gemini API (via Emergent LLM Key) - WORKING (contract translations)
- [x] ReportLab PDF Generation - WORKING (DejaVuSans font)
- [x] Exchange Rates API - WORKING (exchangerate-api.com)
- [x] APScheduler - WORKING (automatic profit accrual)
- [ ] Telegram Bot Auth - PLACEHOLDER (requires bot token)
- [ ] SendGrid Emails - PLACEHOLDER (requires API key)

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Core authentication flow
- [x] Portfolio catalog with yields
- [x] Investment creation with e-signature
- [x] Admin panel basics
- [x] PDF contract generation (Cyrillic)
- [x] Deposit/withdrawal with client account number
- [x] **Automatic Profit Accrual Scheduler (APScheduler)**
- [x] **Dashboard P&L chart with real data**
- [x] **Compound Interest Logic (January 28, 2026)**
- [x] **Term-based Interest Rates (not annual)**
- [x] **Editable Portfolio Display Stats in Admin**
- [x] **Investment Calculator with Compound Interest**

### P1 (High Priority)
- [ ] **iOS Mobile Bottom Navigation Bar Fix** (recurring issue)
- [ ] Actual email sending with SendGrid
- [x] **Mobile PWA Version - Phase 1-2 Complete (January 24, 2026)**

### P2 (Medium Priority)
- [ ] Mobile PWA Version - Phase 3-8 (Premium UI, Page Redesigns, Native Features)
- [ ] Telegram Bot integration
- [ ] Two-factor authentication
- [ ] Push notifications
- [ ] Real-time portfolio updates (WebSocket)

### P3 (Low Priority)
- [ ] Dark mode
- [ ] Advanced reporting/analytics
- [ ] Investment referral program

## Technical Debt
- **CRITICAL**: backend/server.py is 3000+ lines - needs refactoring into routers/services/models

## Test Credentials
- Admin: admin@altyncontract.kz / abc123

## Test Reports
- `/app/test_reports/iteration_20.json` - Investment Logic Overhaul (100% pass rate, all 4 features verified)
- `/app/test_reports/iteration_18.json` - Mobile UI Standardization verification (100% pass rate, 14/14 tests)
- `/app/test_reports/iteration_17.json` - Mobile UI fixes verification (95% pass rate)
- `/app/test_reports/iteration_16.json` - Backend refactoring verification (100% pass rate)

## Mobile UI Fixes (January 26, 2026)
- [x] Landing page - Header with Login button now visible on mobile
- [x] Mobile Dashboard - Compact layout with reduced padding (p-3, space-y-4)
- [x] Mobile Wallet - **COMPLETELY REDESIGNED** - static 100% height layout
  - Deposit/Withdraw buttons accessible at top
  - Modal opens in center with z-index 100
  - Submit button always visible
- [x] Mobile Settings (Profile) - **COMPLETELY REDESIGNED** - static 100% height
  - Sections open as fullscreen overlays
  - KYC, Phone, Language, Profile sections
- [x] Mobile More Page - **COMPLETELY REDESIGNED** - static 100% height
  - Clean menu structure
- [x] Mobile Portfolio Detail - Invest button fixed at bottom-20

## Mobile UI Standardization (January 26, 2026) ✅ COMPLETE
- [x] **Fixed header size (57px)** on all mobile pages
- [x] **Dashboard**: Removed duplicate welcome message from content area (was showing in both header and page body)
- [x] **Portfolios**: Header now shows "Портфели" title instead of user greeting
- [x] **All pages** have consistent header behavior:
  - Dashboard: Shows logo + user greeting + tier badge
  - Portfolios, Wallet, Settings, More: Shows page title
- [x] **Content positioning**: All pages start directly under header without extra padding
- [x] **Bottom navigation**: Works correctly on all pages
- [x] **Test Report**: `/app/test_reports/iteration_18.json` - 100% pass rate (14/14 tests)

## Backend Refactoring Summary (January 26, 2026) ✅ COMPLETE

### Phase 3 Complete - server.py Cleanup
- **server.py reduced from 3809 to 308 lines (92% reduction)**
- All duplicate endpoints removed
- Only scheduler logic and app setup remain in server.py
- Created 12 modular routers with 3355 lines of organized code

### Final Statistics
| Component | Lines | Description |
|-----------|-------|-------------|
| server.py | 308 | App setup, scheduler, CORS |
| routers/ | 3,355 | 12 modular API routers |
| services/ | 147 | Email service |
| models/ | 418 | Pydantic schemas |
| utils/ | 101 | Helper functions |
| **Total** | **4,329** | Clean, maintainable code |

### Modular Routers (12 files)
- `auth.py` (227 lines) — login, register, logout, session
- `user.py` (225 lines) — profile, settings, phone verification
- `portfolios.py` (238 lines) — CRUD, stats, news, featured
- `investments.py` (176 lines) — create, list investments
- `kyc.py` (118 lines) — upload, status
- `support.py` (112 lines) — tickets management
- `deposits.py` (177 lines) — deposit/withdrawal requests
- `admin.py` (862 lines) — full admin panel
- `scheduler.py` (87 lines) — scheduler status/control
- `utilities.py` (149 lines) — exchange rates, translate, health
- `contracts.py` (652 lines) — PDF generation, templates
- `email.py` (281 lines) — email templates, campaigns

## Mobile PWA Implementation (January 24, 2026) - COMPLETE ✅

### Completed (Phase 1-2)
- [x] PWA manifest.json with icons and shortcuts
- [x] Service worker with caching strategies
- [x] Mobile layout wrapper, bottom navigation, header
- [x] Mobile "More" page with menu sections
- [x] i18n translations for mobile UI (RU, KZ, EN)
- [x] CSS classes for responsive layout
- [x] PullToRefresh, haptic feedback, safe area padding

### Completed (Phase 3-4)
- [x] Premium UI components library (MobileUIComponents.js)
- [x] Mobile Dashboard redesign with balance cards, chart, contracts, transactions
- [x] Mobile Wallet redesign with slide-up modals

### Completed (Phase 5)
- [x] Mobile Portfolios page with search and filters
- [x] Mobile Portfolio Detail with tabs, calculator, assets

### Completed (Phase 6)
- [x] Mobile Investment Wizard (MobileInvestWizard.js)
  - 4-step flow with animated progress indicator
  - Signature canvas with touch drawing
  - Success screen with download contract

### Completed (Phase 7-8) - January 24, 2026
- [x] Mobile Settings page (MobileSettings.js)
  - User header card with avatar, name, email, KYC badge
  - Menu sections: Account, Settings, Support
  - Full-screen modals with slide-up animation
  - Personal Info, Phone verification, KYC upload modals
  - Language/currency selector
  - Logout button
- [x] Mobile History page (MobileHistory.js)
  - Tabs: Transactions and Contracts
  - Transactions grouped by date
  - Filter pills (All, Income, Expenses, Profit)
  - Contract cards with progress bars
  - Download contract functionality

### All Mobile Pages Complete (8/8):
✅ Dashboard, ✅ Wallet, ✅ Portfolios, ✅ Portfolio Detail, ✅ More, ✅ Investment Wizard, ✅ Settings, ✅ History

### Future Enhancements
- [x] ~~Push notifications~~ ✅ IMPLEMENTED (January 26, 2026)
- [ ] Gesture navigation (swipe to go back)
- [ ] Offline data caching
- [ ] Biometric authentication

## Next Action Items
1. ~~Mobile UI Standardization~~ ✅ COMPLETE (January 26, 2026)
2. ~~Push notifications for PWA~~ ✅ COMPLETE (January 26, 2026)
3. ~~Telegram Bot notifications~~ CANCELLED by user
4. ~~P0: Early Termination Payout Logic~~ ✅ COMPLETE (January 26, 2026)
5. P1: iOS Bottom Navigation Fix (in progress)
6. Optional: Biometric authentication for PWA (P2)
7. Optional: Desktop Investment Wizard completion (P3)

## Mobile Support Page Fullscreen Update (January 26, 2026) ✅ COMPLETE
**Requirement:** Make support page static and fill exactly 100% of the visible viewport.

**Implementation:**
- Created new `MobileSupportPage.js` with `fixed inset-0 flex flex-col` layout
- Header with support icon and "Помощь 24/7" text
- Ticket list with scrollable content area
- Create ticket form with full-screen overlay
- Bottom navigation included
- App.js updated to skip MobileLayout wrapper for /support route

**Files Modified:**
- `/app/frontend/src/pages/MobileSupportPage.js` - New fullscreen mobile support page
- `/app/frontend/src/pages/SupportPage.js` - Updated to use MobileSupportPage for mobile
- `/app/frontend/src/App.js` - Added special handling for /support route

## Email Notifications for Key Events (January 26, 2026) ✅ COMPLETE
**Events with email notifications:**
- Deposit approved - sends email with amount details
- Withdrawal approved/rejected - sends email with status
- Investment contract signed - sends email with contract details (amount, term, expected profit)

**Files Modified:**
- `/app/backend/routers/notifications.py` - Added `send_email_notification()` helper and integrated with deposit/withdrawal triggers
- `/app/backend/routers/investments.py` - Added contract email sending on investment creation

## Mobile Invest Wizard Fullscreen Update (January 26, 2026) ✅ COMPLETE
**Requirement:** Make all 4 investment steps static and fill exactly 100% of the visible viewport.

**Implementation:**
- Changed container from `min-h-screen` to `fixed inset-0 flex flex-col`
- Header: `flex-shrink-0` - fixed height
- Content: `flex-1 flex flex-col overflow-hidden` - fills remaining space
- Bottom CTA: `flex-shrink-0` - fixed at bottom
- Each step uses `flex-1 overflow-y-auto` for scrollable content if needed
- Compact step indicators (7x7 circles vs 8x8)
- Reduced padding and font sizes to fit in viewport
- Canvas signature area uses `flex-1 min-h-[120px]` for responsive height

**Files Modified:**
- `/app/frontend/src/pages/MobileInvestWizard.js` - Complete rewrite of layout structure

## P0 Fix: Early Termination Payout & Remaining Profit (January 26, 2026) ✅ COMPLETE
**Problem:** When admin terminates a contract early with payout, the system was only returning principal amount without considering remaining unpaid profit.

**Solution Implemented:**
- [x] Backend API enhanced to calculate `remaining_profit = expected_return - paid_profit`
- [x] GET `/api/admin/users/{user_id}` returns `paid_profit` and `remaining_profit` per investment
- [x] GET `/api/investments` returns `paid_profit` and `remaining_profit` per investment
- [x] POST `/api/admin/investments/{investment_id}/terminate` calculates payout as `principal + remaining_profit`
- [x] Admin Panel (AdminUserDetail.js):
  - Investment list shows remaining profit as "ожид. прибыль" 
  - Shows "Выплачено" for already paid profit
  - Terminate dialog shows full breakdown: total expected, already paid, remaining, and return amount
- [x] Mobile Client (MobileDashboard.js, MobileHistory.js):
  - Dashboard "Прогнозируемый доход" shows sum of remaining profits
  - Contract cards show "Ожид. прибыль" (remaining) and "Выплачено" (paid)

**Files Modified:**
- `/app/backend/routers/admin.py`: Enhanced GET /users/{user_id} and POST /investments/{id}/terminate
- `/app/backend/routers/investments.py`: Enhanced GET /investments
- `/app/frontend/src/pages/admin/AdminUserDetail.js`: Updated investment display and terminate dialog
- `/app/frontend/src/pages/MobileDashboard.js`: Use remaining_profit instead of expected_return
- `/app/frontend/src/pages/MobileHistory.js`: Show remaining_profit and paid_profit

**Test Report:** `/app/test_reports/iteration_19.json` - 100% pass rate

## Push Notifications (January 26, 2026) ✅ COMPLETE
- [x] Backend API (`/app/backend/routers/notifications.py`)
  - VAPID keys for Web Push
  - Subscribe/unsubscribe endpoints
  - Test notification endpoint
  - Notification triggers for: profit accrual, deposit approval, withdrawal processing, contract signing
- [x] Service Worker push handling (`/app/frontend/public/service-worker.js`)
- [x] Frontend hook (`/app/frontend/src/hooks/usePushNotifications.js`)
- [x] UI in MobileSettings - Enable/disable notifications, test button
- [x] Integration with business logic:
  - Profit accrual → Push notification
  - Deposit approved → Push notification
  - Withdrawal processed → Push notification
  - Contract signed → Push notification

## Security (2FA) (January 26, 2026) ✅ COMPLETE
- [x] Google Authenticator (TOTP) - setup, verify, disable
- [x] Email 2FA - setup, verify, disable
- [x] Login with 2FA verification
- [x] Admin panel - disable 2FA for users

## Backend Refactoring Status (January 24, 2026) - PHASE 1 COMPLETE ✅

### Completed
- [x] Created modular directory structure
- [x] `/app/backend/config.py` - Configuration settings
- [x] `/app/backend/database.py` - MongoDB connection and collections
- [x] `/app/backend/models/` - Pydantic schemas (341 lines)
  - `schemas.py` - All data models (User, Portfolio, Investment, Transaction, etc.)
- [x] `/app/backend/services/` - Business logic (141 lines)
  - `email_service.py` - Email sending (SendGrid/SMTP)
- [x] `/app/backend/utils/` - Helper functions (81 lines)
  - `helpers.py` - Auth, password hashing, tier calculation
- [x] `/app/backend/routers/` - API endpoints (709 lines)
  - `auth.py` - Authentication (login, register, logout, session)
  - `user.py` - User profile, settings, phone verification, transactions
  - `portfolios.py` - Portfolio CRUD, stats, news, featured
- [x] All tests passing (100% backend + frontend)

### Current Stats
- **server.py**: 3809 lines (original, will be reduced in Phase 3)
- **Modular routers**: 3355 lines (12 router files)
- **Total modules extracted**: ~4000+ lines
- **Total codebase**: Well-organized, maintainable

### Phase 2 (COMPLETE) - January 26, 2026
- [x] Integrate new routers into server.py
- [x] Move investment endpoints to routers/investments.py
- [x] Move KYC endpoints to routers/kyc.py
- [x] Move support endpoints to routers/support.py
- [x] Move deposit/withdrawal endpoints to routers/deposits.py
- [x] Move admin endpoints to routers/admin.py
- [x] Create scheduler router (routers/scheduler.py)
- [x] Create utilities router (routers/utilities.py) - exchange rates, translations, health
- [x] Create contracts router (routers/contracts.py) - PDF generation, contract templates
- [x] Create email router (routers/email.py) - email templates, campaigns, notifications

### Phase 3 (COMPLETE) - January 26, 2026
- [x] Remove duplicate endpoints from server.py
- [x] Reduce server.py from 3809 to 308 lines (92% reduction)
- [x] Verify all API endpoints work correctly
- [x] Test frontend integration

### Current Structure (Final - January 26, 2026)
```
/app/backend/
├── server.py          # ✅ Clean entry point (308 lines)
├── config.py          # ✅ App settings (35 lines)
├── database.py        # ✅ MongoDB connection (26 lines)
├── models/
│   ├── __init__.py    # ✅ Exports (77 lines)
│   └── schemas.py     # ✅ All Pydantic models (341 lines)
├── routers/
│   ├── __init__.py    # ✅ Router aggregation (50 lines)
│   ├── auth.py        # ✅ Auth endpoints (227 lines)
│   ├── user.py        # ✅ User endpoints (225 lines)
│   ├── portfolios.py  # ✅ Portfolio endpoints (238 lines)
│   ├── investments.py # ✅ Investment endpoints (176 lines)
│   ├── kyc.py         # ✅ KYC endpoints (118 lines)
│   ├── support.py     # ✅ Support endpoints (112 lines)
│   ├── deposits.py    # ✅ Deposit/Withdrawal endpoints (177 lines)
│   ├── admin.py       # ✅ Admin endpoints (862 lines)
│   ├── scheduler.py   # ✅ Scheduler status/control (87 lines)
│   ├── utilities.py   # ✅ Exchange rates, translate, health (149 lines)
│   ├── contracts.py   # ✅ PDF generation, templates (652 lines)
│   └── email.py       # ✅ Email templates, campaigns (281 lines)
├── services/
│   ├── __init__.py    # ✅ Exports (6 lines)
│   └── email_service.py # ✅ Email service (141 lines)
└── utils/
    ├── __init__.py    # ✅ Exports (20 lines)
    └── helpers.py     # ✅ Helpers (81 lines)
```

## API Endpoints (Key)

### Scheduler
- `GET /api/scheduler/status` - Returns scheduler running status and jobs
- `POST /api/scheduler/run-now` - Manually triggers profit accrual

### Profit Analytics
- `GET /api/user/profit-analytics` - Returns monthly profit data for charts

### User
- `POST /api/auth/login` - Returns user data including account_number
- `GET /api/auth/me` - Returns current user data including account_number

## Site Content Management (January 26, 2026) ✅ COMPLETE
**Requirement:** Admin panel functionality to upload PDF documents for the footer and edit contact information.

**Implementation:**
- [x] Admin page "Контент сайта" (`/admin/site-content`) with two tabs:
  - **Документы** - Upload PDF files for:
    - Правовая информация (Legal Information)
    - Политика конфиденциальности (Privacy Policy)
    - Раскрытие информации (Disclosure)
    - Тарифы и комиссии (Fees & Commissions)
  - **Контакты** - Edit contact info:
    - Phone number and working hours (RU)
    - Email address
    - Address in 3 languages (RU, EN, KZ)
- [x] Backend API endpoints:
  - `GET/POST /api/admin/site-documents` - Manage site documents (admin only)
  - `DELETE /api/admin/site-documents/{doc_type}` - Remove document (admin only)
  - `GET/PUT /api/admin/contact-info` - Manage contact info (admin only)
  - `GET /api/site-documents` - Public endpoint for footer
  - `GET /api/contact-info` - Public endpoint for footer
  - `POST /api/upload` - File upload endpoint
- [x] Footer updated to fetch data from API
  - Documents show as links when PDF is uploaded, gray when not
  - Contact info displays phone, email, address from database

**Files Created/Modified:**
- `/app/frontend/src/pages/admin/AdminSiteContent.js` - NEW: Admin page for content management
- `/app/frontend/src/App.js` - Added route for /admin/site-content
- `/app/frontend/src/pages/admin/AdminLayout.js` - Added "Контент сайта" menu item
- `/app/backend/routers/admin.py` - Added site-documents and contact-info endpoints
- `/app/backend/routers/utilities.py` - Added public endpoints and file upload
- `/app/frontend/src/components/Footer.js` - Updated to use API data

**Collections Added:**
- `site_documents` - Stores document type, file URL, title, update timestamp
- `site_settings` (with setting_id="contact_info") - Stores contact information


---

## Ребрендинг Phillip Capital Invest (Январь 2026) ✅ COMPLETE

### Выполнено:
- **Удалён казахский язык (kz)** полностью из фронтенда и бэкенда
- **Добавлен турецкий (tr)** как основной язык по умолчанию
- Поддерживаемые языки теперь: **TR (default), RU, EN**
- **Переключатель языков** в шапке рядом с профилем (десктоп + мобилка)
- Язык сохраняется в localStorage (`pci_language`) + синхронизируется с профилем через `PUT /api/user/settings` (preferred_language)
- Определение языка: профиль → localStorage → browser → default `tr`
- **Новый логотип** `/app/frontend/src/components/Logo.js` (SVG): тёмно-синий #0B1E3F + золотой #C9A24B, wordmark "Phillip Capital INVEST"
- **Ребрендинг** "AltynContract" → "Phillip Capital Invest" во всех файлах
- **Валюта KZT → TRY (₺)** в балансах, списке валют и курсах
- Удалены все упоминания НБ РК / KASE / тенге / Казахстана — заменены на нейтральные (Global Member, License №...)
- Контактная информация обновлена на Стамбульские реквизиты
- PWA manifest.json, index.html, splash screen обновлены
- Intl.DateTimeFormat/NumberFormat использует `tr-TR` для турецкого

### Ключевые файлы:
- `frontend/src/i18n/LanguageContext.js` — новая конфигурация языков (tr/ru/en), миграция из legacy keys
- `frontend/src/i18n/translations.js` — полный перевод на tr (ручной, не машинный), обновлены ru/en
- `frontend/src/components/Logo.js` — новый бренд-марк (SVG)
- `frontend/src/components/LanguageSwitcher.js` — новый компонент переключателя
- `frontend/src/components/Header.js`, `MobileHeader.js`, `Footer.js` — интегрированы Logo и LanguageSwitcher
- `frontend/src/pages/LandingPage.js` — удалён kz-блок, добавлен tr-блок
- `frontend/public/{index.html,manifest.json}` — обновлено
- `backend/routers/{auth,admin,utilities,notifications}.py`, `models/schemas.py`, `init_db.py` — KZT→TRY, брендинг

