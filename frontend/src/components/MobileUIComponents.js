import React from 'react';
import { cn } from '../lib/utils';

// Premium animated balance card for mobile
export function MobileBalanceCard({ 
  title, 
  amount, 
  subtitle, 
  icon: Icon, 
  variant = 'primary',
  action,
  className 
}) {
  const variants = {
    primary: 'from-primary via-emerald-700 to-emerald-800',
    gold: 'from-amber-500 via-amber-600 to-orange-600',
    secondary: 'from-slate-700 via-slate-800 to-slate-900',
    success: 'from-green-500 via-green-600 to-emerald-700'
  };

  return (
    <div 
      className={cn(
        `mobile-balance-card bg-gradient-to-br ${variants[variant]} relative overflow-hidden p-4`,
        className
      )}
      data-testid="mobile-balance-card"
    >
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/70 text-xs font-medium">{title}</span>
          {Icon && <Icon className="w-4 h-4 text-white/50" />}
        </div>
        
        <div className="text-2xl font-bold text-white mb-0.5 tracking-tight">
          {amount}
        </div>
        
        {subtitle && (
          <p className="text-white/60 text-xs">{subtitle}</p>
        )}
        
        {action && (
          <div className="mt-3">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}

// Quick action button for mobile
export function MobileActionButton({ 
  icon: Icon, 
  label, 
  onClick, 
  variant = 'default',
  disabled = false 
}) {
  const variants = {
    default: 'bg-white text-gray-900 hover:bg-gray-50',
    primary: 'bg-primary text-white hover:bg-primary/90',
    outline: 'bg-transparent border-2 border-white/30 text-white hover:bg-white/10'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        `flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 touch-feedback`,
        variants[variant],
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      data-testid="mobile-action-button"
    >
      {Icon && <Icon className="w-4 h-4" />}
      <span>{label}</span>
    </button>
  );
}

// Stat item for mobile dashboard
export function MobileStatItem({ label, value, icon: Icon, trend, trendValue }) {
  return (
    <div className="mobile-card p-3" data-testid="mobile-stat-item">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
        )}
      </div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
      {trend && (
        <div className={cn(
          "flex items-center gap-1 mt-1 text-sm font-medium",
          trend === 'up' ? 'text-green-600' : 'text-red-600'
        )}>
          <span>{trend === 'up' ? '↑' : '↓'}</span>
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}

// Transaction item for mobile
export function MobileTransactionItem({ type, amount, date, status, isIncome }) {
  const statusColors = {
    completed: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700'
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0" data-testid="mobile-transaction-item">
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          isIncome ? 'bg-green-100' : 'bg-amber-100'
        )}>
          <span className={cn(
            "text-lg",
            isIncome ? 'text-green-600' : 'text-amber-600'
          )}>
            {isIncome ? '↓' : '↑'}
          </span>
        </div>
        <div>
          <p className="font-medium text-gray-900">{type}</p>
          <p className="text-sm text-gray-500">{date}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={cn(
          "font-semibold",
          isIncome ? 'text-green-600' : 'text-gray-900'
        )}>
          {isIncome ? '+' : '-'}{amount}
        </p>
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full",
          statusColors[status] || statusColors.pending
        )}>
          {status}
        </span>
      </div>
    </div>
  );
}

// Contract card for mobile
export function MobileContractCard({ 
  contractId, 
  portfolioName, 
  amount, 
  expectedReturn, 
  progress, 
  daysLeft, 
  status,
  onDownload 
}) {
  return (
    <div className="mobile-card p-4 space-y-4" data-testid="mobile-contract-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-primary">#{contractId}</p>
          <p className="text-sm text-gray-500">{portfolioName}</p>
        </div>
        <span className={cn(
          "px-2 py-1 rounded-lg text-xs font-medium",
          status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        )}>
          {status === 'active' ? 'Активный' : status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Сумма</p>
          <p className="font-semibold">{amount}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Прибыль</p>
          <p className="font-semibold text-green-600">+{expectedReturn}</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Прогресс</span>
          <span className="font-medium">{daysLeft}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {onDownload && (
        <button
          onClick={onDownload}
          className="w-full py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <span>📄</span>
          Скачать контракт
        </button>
      )}
    </div>
  );
}

// Section header for mobile
export function MobileSectionHeader({ title, action, actionLabel }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {action && (
        <button 
          onClick={action}
          className="text-sm font-medium text-primary hover:underline"
        >
          {actionLabel || 'Все'}
        </button>
      )}
    </div>
  );
}

// Skeleton loader for mobile
export function MobileSkeleton({ variant = 'card' }) {
  if (variant === 'card') {
    return (
      <div className="mobile-card p-4 space-y-3">
        <div className="skeleton h-4 w-1/3 rounded" />
        <div className="skeleton h-8 w-2/3 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
      </div>
    );
  }

  if (variant === 'balance') {
    return (
      <div className="mobile-balance-card bg-gray-300">
        <div className="skeleton h-4 w-1/3 rounded mb-3" />
        <div className="skeleton h-10 w-2/3 rounded mb-2" />
        <div className="skeleton h-4 w-1/2 rounded" />
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton w-10 h-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-3 w-1/3 rounded" />
            </div>
            <div className="skeleton h-6 w-20 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return <div className="skeleton h-20 rounded-lg" />;
}

export default {
  MobileBalanceCard,
  MobileActionButton,
  MobileStatItem,
  MobileTransactionItem,
  MobileContractCard,
  MobileSectionHeader,
  MobileSkeleton
};
