# backend/api/management/commands/check_price_alerts.py
import logging
from django.core.management.base import BaseCommand
from ...services.price_alert_service import get_price_alert_service

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Check all active price alerts and trigger notifications'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run in dry-run mode (no alerts will be triggered)',
        )

    def handle(self, *args, **options):
        """Main command handler"""
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('Running in DRY-RUN mode - no alerts will be triggered'))
        
        self.stdout.write('Starting price alert check...')
        
        try:
            alert_service = get_price_alert_service()
            
            if dry_run:
                # In dry-run mode, just get statistics
                stats = alert_service.get_alert_statistics()
                self.stdout.write(f'Active alerts: {stats["active_alerts"]}')
                self.stdout.write(f'Total alerts: {stats["total_alerts"]}')
                self.stdout.write('DRY-RUN: No alerts checked or triggered')
            else:
                # Actually check alerts
                results = alert_service.check_all_active_alerts()
                
                self.stdout.write(f'Alerts checked: {results["alerts_checked"]}')
                self.stdout.write(f'Alerts triggered: {results["alerts_triggered"]}')
                
                if results['errors'] > 0:
                    self.stdout.write(
                        self.style.WARNING(f'Errors encountered: {results["errors"]}')
                    )
                
                # Show triggered alerts
                for triggered in results['triggered_alerts']:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'TRIGGERED: {triggered["ticker"]} {triggered["alert_type"]} '
                            f'${triggered["target_price"]} (current: ${triggered["current_price"]})'
                        )
                    )
            
            self.stdout.write(self.style.SUCCESS('Price alert check completed'))
            
        except Exception as e:
            logger.error(f"Error in price alert check command: {e}", exc_info=True)
            self.stdout.write(
                self.style.ERROR(f'Price alert check failed: {e}')
            )
            raise 