# Portfolio Tracker - Documentation Automation Makefile
#
# ZERO TOLERANCE FOR MANUAL DOCUMENTATION
# All documentation is auto-generated and validated

.PHONY: help docs docs-api docs-types docs-security docs-validate docs-clean install-deps

# Default target
help:
	@echo "Portfolio Tracker Documentation Automation"
	@echo "=========================================="
	@echo ""
	@echo "📚 Documentation Commands:"
	@echo "  make docs          - Generate ALL documentation (recommended)"
	@echo "  make docs-api      - Generate API documentation only"
	@echo "  make docs-types    - Generate TypeScript types only"  
	@echo "  make docs-security - Generate security documentation only"
	@echo "  make docs-validate - Validate documentation consistency"
	@echo "  make docs-clean    - Clean generated documentation files"
	@echo ""
	@echo "🔧 Setup Commands:"
	@echo "  make install-deps  - Install required dependencies"
	@echo ""
	@echo "⚠️  ZERO TOLERANCE POLICY:"
	@echo "   - Manual documentation edits are FORBIDDEN"
	@echo "   - All docs are auto-generated from code"
	@echo "   - CI blocks documentation drift"

# Generate all documentation
docs:
	@echo "🚀 Generating ALL documentation..."
	@echo "=================================="
	@python scripts/generate_all_docs.py

# Generate API documentation only
docs-api:
	@echo "📝 Generating API documentation..."
	@python scripts/generate_api_docs.py

# Generate TypeScript types only
docs-types:
	@echo "🔧 Generating TypeScript types..."
	@python scripts/sync_types.py

# Generate security documentation only
docs-security:
	@echo "🔒 Generating security documentation..."
	@python scripts/security_docs_sync.py

# Validate documentation consistency
docs-validate:
	@echo "🔍 Validating documentation consistency..."
	@echo "Checking for documentation drift..."
	@python scripts/generate_api_docs.py
	@python scripts/sync_types.py
	@python scripts/security_docs_sync.py
	@echo "Checking git status for changes..."
	@if git diff --exit-code docs/ frontend/src/types/generated-*.ts; then \
		echo "✅ Documentation is up to date"; \
	else \
		echo "❌ Documentation drift detected!"; \
		echo "🔧 Generated docs differ from committed versions"; \
		echo "   Run 'make docs' and commit the changes"; \
		exit 1; \
	fi

# Clean generated documentation files
docs-clean:
	@echo "🧹 Cleaning generated documentation files..."
	@rm -f docs/openapi.json
	@rm -f docs/api_doc.md
	@rm -f docs/security.md
	@rm -f docs/documentation-generation-report.md
	@rm -f frontend/src/types/generated-api.ts
	@rm -f frontend/src/types/generated-models.ts
	@echo "✅ Generated documentation files cleaned"

# Install required dependencies
install-deps:
	@echo "📦 Installing documentation dependencies..."
	@echo "Backend dependencies..."
	@cd backend_simplified && pip install -r requirements.txt
	@echo "Frontend dependencies..."
	@cd frontend && npm install
	@echo "✅ Dependencies installed"

# Quick development workflow
dev-docs: docs-clean docs
	@echo "🎉 Development documentation refresh complete!"

# CI-compatible validation (no git operations)
ci-validate:
	@echo "🔍 CI Documentation Validation..."
	@python scripts/generate_all_docs.py
	@echo "✅ CI validation complete"

# Show documentation status
docs-status:
	@echo "📊 Documentation Status"
	@echo "======================"
	@echo ""
	@echo "Generated Files:"
	@ls -la docs/openapi.json docs/api_doc.md docs/security.md 2>/dev/null || echo "  No generated files found"
	@ls -la frontend/src/types/generated-*.ts 2>/dev/null || echo "  No generated TypeScript files found"
	@echo ""
	@echo "Documentation Scripts:"
	@ls -la scripts/generate_*.py scripts/sync_*.py scripts/security_*.py
	@echo ""
	@echo "CI Configuration:"
	@ls -la .github/workflows/docs-validation.yml

# Force regeneration (ignore git status)
docs-force: docs-clean docs
	@echo "🔄 Forced documentation regeneration complete!"

# Validate TypeScript compilation after type generation
docs-typescript-check: docs-types
	@echo "🔍 Checking TypeScript compilation..."
	@cd frontend && npx tsc --noEmit --strict
	@echo "✅ TypeScript compilation successful"