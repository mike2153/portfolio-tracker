import logging
from django.db import connections

logger = logging.getLogger('django')

class SupabaseLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Log after the response is prepared
        if response.status_code >= 200 and response.status_code < 300:
            logger.info("Superbase -> Backend: Request processed successfully.")
        
        # Clean up database connections after each request
        try:
            for conn in connections.all():
                conn.close_if_unusable_or_obsolete()
        except Exception as e:
            logger.warning(f"Connection cleanup warning: {e}")
            
        return response 

class DatabaseConnectionMiddleware:
    """
    Middleware to ensure proper database connection management.
    Prevents connection pool exhaustion by cleaning up connections.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Ensure connection health before processing
        try:
            from django.db import connection
            connection.ensure_connection()
        except Exception as e:
            logger.error(f"Database connection issue: {e}")
        
        response = self.get_response(request)
        
        # Clean up connections after processing
        try:
            for conn in connections.all():
                if conn.queries_logged > 50:  # If many queries, close connection
                    conn.close()
                else:
                    conn.close_if_unusable_or_obsolete()
        except Exception as e:
            logger.warning(f"Post-request connection cleanup: {e}")
        
        return response 