"""backend.api.services package init

This file ensures that pytest treats the services directory as a true package so
relative imports ("from ..models import …") work when the module is executed
stand-alone during test collection.
""" 