import logging

logger = logging.getLogger('django')

class SupabaseLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Log after the response is prepared
        if response.status_code >= 200 and response.status_code < 300:
            logger.info("Superbase -> Backend: Request processed successfully.")
            
        return response 