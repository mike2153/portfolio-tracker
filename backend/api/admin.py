from django.contrib import admin
from django.utils.html import format_html
from django.contrib import messages
from .models import (
    StockSymbol, SymbolRefreshLog, Portfolio, Holding, 
    CashContribution, DividendPayment, PriceAlert, PortfolioSnapshot,
    CachedDailyPrice, CachedCompanyFundamentals
)

# Register your models here.

@admin.register(StockSymbol)
class StockSymbolAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'name', 'exchange_code', 'currency', 'country', 'type', 'is_active')
    list_filter = ('exchange_code', 'currency', 'country', 'type', 'is_active')
    search_fields = ('symbol', 'name', 'exchange_name')
    list_per_page = 50

@admin.register(SymbolRefreshLog)
class SymbolRefreshLogAdmin(admin.ModelAdmin):
    list_display = ('exchange_code', 'last_refresh', 'total_symbols', 'success')
    list_filter = ('success', 'exchange_code')
    readonly_fields = ('last_refresh',)

@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = ('name', 'user_id', 'cash_balance', 'created_at')
    search_fields = ('user_id', 'name')
    list_filter = ('created_at',)

@admin.register(Holding)
class HoldingAdmin(admin.ModelAdmin):
    list_display = ('ticker', 'company_name', 'shares', 'purchase_price', 'purchase_date', 'portfolio')
    list_filter = ('exchange', 'currency', 'purchase_date', 'used_cash_balance')
    search_fields = ('ticker', 'company_name', 'portfolio__user_id')

@admin.register(CashContribution)
class CashContributionAdmin(admin.ModelAdmin):
    list_display = ('portfolio', 'amount', 'contribution_date', 'description')
    list_filter = ('contribution_date',)
    search_fields = ('portfolio__user_id', 'description')

@admin.register(DividendPayment)
class DividendPaymentAdmin(admin.ModelAdmin):
    list_display = ('holding', 'ex_date', 'amount_per_share', 'total_amount', 'confirmed_received')
    list_filter = ('confirmed_received', 'ex_date', 'payment_date')
    search_fields = ('holding__ticker', 'holding__portfolio__user_id')

@admin.register(PriceAlert)
class PriceAlertAdmin(admin.ModelAdmin):
    list_display = ('ticker', 'alert_type', 'target_price', 'is_active', 'portfolio')
    list_filter = ('alert_type', 'is_active', 'triggered_at')
    search_fields = ('ticker', 'portfolio__user_id')

@admin.register(PortfolioSnapshot)
class PortfolioSnapshotAdmin(admin.ModelAdmin):
    list_display = ('portfolio', 'snapshot_date', 'total_value', 'cash_balance', 'stock_value')
    list_filter = ('snapshot_date',)
    search_fields = ('portfolio__user_id',)

@admin.register(CachedDailyPrice)
class CachedDailyPriceAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'date', 'adjusted_close', 'volume', 'updated_at')
    list_filter = ('date', 'updated_at')
    search_fields = ('symbol',)
    readonly_fields = ('created_at', 'updated_at')
    list_per_page = 100
    
    def get_queryset(self, request):
        return super().get_queryset(request).order_by('-date', 'symbol')

@admin.register(CachedCompanyFundamentals)
class CachedCompanyFundamentalsAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'last_updated_display', 'market_capitalization', 'pe_ratio', 'pb_ratio', 'dividend_yield')
    list_filter = ('last_updated',)
    search_fields = ('symbol',)
    readonly_fields = ('created_at', 'data_preview')
    actions = ['force_refresh_fundamentals']
    
    def last_updated_display(self, obj):
        """Display last updated in a user-friendly format"""
        return obj.last_updated.strftime('%Y-%m-%d %H:%M')
    last_updated_display.short_description = 'Last Updated'
    
    def data_preview(self, obj):
        """Display a preview of the JSON data"""
        if obj.data:
            preview = str(obj.data)[:200] + "..." if len(str(obj.data)) > 200 else str(obj.data)
            return format_html('<pre>{}</pre>', preview)
        return "No data"
    data_preview.short_description = 'Data Preview'
    
    def force_refresh_fundamentals(self, request, queryset):
        """Custom admin action to force refresh selected fundamentals"""
        from django.core.management import call_command
        import io
        import sys
        
        symbols = [obj.symbol for obj in queryset]
        symbol_list = ','.join(symbols)
        
        # Capture command output
        old_stdout = sys.stdout
        sys.stdout = buffer = io.StringIO()
        
        try:
            call_command('update_market_data', 
                        symbols=symbol_list, 
                        skip_prices=True, 
                        force_refresh=True)
            output = buffer.getvalue()
            messages.success(request, f'Successfully refreshed {len(symbols)} symbols. Output: {output[:200]}...')
        except Exception as e:
            messages.error(request, f'Error refreshing fundamentals: {e}')
        finally:
            sys.stdout = old_stdout
    
    force_refresh_fundamentals.short_description = "Force refresh selected fundamentals"
