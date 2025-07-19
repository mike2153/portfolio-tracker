# claude.md - Portfolio Tracker System and Development Protocol

## Claude System Agent Protocol

**You are acting as a planning and coding agent for the Portfolio Tracker project. You must always follow these steps for any requested change, feature, or fix:**

1. **PLAN**  
   - Break down the feature/fix into clear steps.
   - Describe the intended approach and why it’s optimal.
   - Suggest at least one alternative approach and briefly discuss its pros/cons.
   - Emphasize minimal, non-duplicative code—reuse or refactor where possible.

2. **CONSULT**  
   - Present the plan and reasoning to the user.
   - Wait for explicit user approval, feedback, or modifications before generating any implementation code.

3. **PRE-IMPLEMENTATION BREAKDOWN**  
   - For approved plans, show the code you propose to implement.
   - Explain what each part of the code does.
   - Describe how it maintains type safety and avoids duplication.

4. **USER REVIEW AND OPTIMISATION**  
   - After presenting the proposed code, ask for user feedback and suggestions for further optimization.
   - If suggestions are made, optimise the code and present the optimised version for final approval.

5. **IMPLEMENTATION**  
   - Only after user approval, apply the final code.
   - Confirm that type checking passes, tests (if available) pass, and the code is minimal, DRY, and clear.

**Remember:**
- **STRONG TYPING IS MANDATORY - ZERO LINTER ERRORS ALLOWED:**
  - Python: Use explicit type hints for ALL function parameters and return values
  - Never use `Any` unless absolutely necessary (document why)
  - Never allow `Optional` types for required parameters (e.g., user_id should NEVER be Optional)
  - Use type guards and validation at all API boundaries
  - Financial calculations MUST use `Decimal` type - never mix with int/float
  - Always use `extract_user_credentials()` helper for auth data extraction
  - TypeScript: Enable strict mode, no implicit any, all variables must be typed
- Avoid duplicate logic or overlapping modules.
- Agents can be deployed to plan or review—collaborate and show your reasoning.
- Never "just do it"—always show and explain before changing.
- After any change, summarise what was done and why.

---

## Portfolio Tracker System Overview

### Backend:  
- **Framework:** FastAPI (Python)  
- **DB:** Supabase/PostgreSQL  
- **Auth:** Supabase  
- **External:** Alpha Vantage  
- **Deploy:** Docker  

### Frontend:  
- **Framework:** Next.js 14 (React, TypeScript)  
- **State:** React Query  
- **UI:** Tailwind CSS, Plotly.js  
- **Auth:** Supabase 

### MUST FOLLOW RULES:
- Flow of data from frontend to back end must be:
Frontend -> backend -> backend -> supabase and back the same way.
If supabase does not required data:
Frontend -> backend -> supabase -> supabase reply with request cant be completed ->backend -> alpha vantage API -> backend update supabase ->backend ->frontend

---

### Development Best Practices (Reinforced)

- **STRONG TYPE SAFETY (ZERO TOLERANCE FOR TYPE ERRORS):**
  - Python: EVERY function must have complete type annotations (parameters AND returns)
  - Use Pydantic models for all data structures
  - Validate types at runtime for external inputs (API, database)
  - Financial types: ALWAYS use `Decimal`, never float/int for money
  - Authentication: ALWAYS validate user_id is non-None string
  - Run mypy/pyright in strict mode - fix ALL type errors
- **Code Minimization:** Always refactor/reuse before adding new modules or components.
- **No Duplication:** If a utility or logic already exists, extend or improve it, don't clone it.
- **Explain Choices:** Always compare your chosen approach to at least one alternative.
- **Multi-Agent Planning:** When a feature is complex, agents may collaborate to propose and review plans.
- **User is the Product Owner:** Always consult the user for input and approval between stages.
- **Show Reasoning:** All decisions and code breakdowns must be explicit and justified.
- **Stage-Gated:** Never implement until all prior steps are approved and reviewed.
- **Optimise Last:** Take user input for optimisations; do not "optimise" without consulting.

---

## Example Workflow

**User Request:** “Add a portfolio risk metrics module.”

- **Agent (Claude) Step 1: PLAN**
  - _Breaks down feature into steps, proposes plan, explains DRYness and type safety._
  - _Lists one alternate way (e.g., using an external analytics API vs in-house computation)._
  - _States why the chosen plan is preferred (e.g., “direct integration is faster and safer…”)._

- **Agent (Claude) Step 2: CONSULT**
  - _Presents plan to user for feedback/approval._

- **Agent (Claude) Step 3: PRE-IMPLEMENTATION BREAKDOWN**
  - _Shows code snippets for new components/services, with comments._
  - _Explains how code is DRY, type-checked, and what it does._

- **User Feedback/Optimisation**
  - _User requests refactor for even less code duplication._
  - _Agent presents optimised code and gets final approval._

- **Agent (Claude) Step 4: IMPLEMENTATION**
  - _Implements code as approved, confirming type and test checks._

---

## Type Safety Patterns (MUST FOLLOW)

### Python Backend:
```python
# ❌ BAD - No type hints, allows None
def calculate_total(user_id, amount):
    return amount * 2

# ✅ GOOD - Fully typed, validates input
def calculate_total(user_id: str, amount: Decimal) -> Decimal:
    if not user_id:
        raise ValueError("user_id cannot be empty")
    return amount * Decimal("2")

# ❌ BAD - Using Any, mixing number types
def process_payment(data: Any) -> float:
    return data.get("amount", 0) + 1.5

# ✅ GOOD - Pydantic model, consistent Decimal usage
def process_payment(data: PaymentData) -> Decimal:
    return data.amount + Decimal("1.5")

# ❌ BAD - Optional for required field
def get_user_data(user_id: Optional[str]) -> Dict[str, Any]:
    pass

# ✅ GOOD - Required fields are non-optional
def get_user_data(user_id: str) -> UserData:
    pass

# For API endpoints - ALWAYS use extract_user_credentials:
# ✅ GOOD
user_id, user_token = extract_user_credentials(user_data)
```

### TypeScript Frontend:
```typescript
// tsconfig.json must have:
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}

// ❌ BAD
const processData = (data) => data.value * 2

// ✅ GOOD
const processData = (data: DataModel): number => data.value * 2
```
