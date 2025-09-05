# Engineering Doctrine - V3 Dorkinians Website

## React & Next.js Best Practices

### Component Lifecycle & Hooks Safety

#### React Hooks Ordering in Transition Components
- **Rule**: Never place conditional returns after hooks in components that may be rendered during transitions (AnimatePresence, Suspense, etc.)
- **Rationale**: Transition libraries keep components mounted during exit animations, causing hooks ordering violations when conditional returns change the execution path
- **Implementation**: Use parent-level conditional rendering instead of component-level conditional returns for transition components
- **Example**:
  ```typescript
  // ❌ BAD - Conditional return after hooks in AnimatePresence component
  function StatsContainer() {
    const { currentMainPage } = useNavigationStore();
    // ... other hooks
    if (currentMainPage !== "stats") return null; // Causes hooks ordering violation
  }

  // ✅ GOOD - Parent-level conditional rendering
  case "stats":
    return currentMainPage === "stats" ? <StatsContainer /> : null;
  ```

#### HTML Validation in React Components
- **Rule**: Always validate that React component structure produces valid HTML, especially with table elements
- **Rationale**: Invalid HTML structure causes hydration errors and breaks SSR/SSG
- **Implementation**: Use proper React patterns for table elements and avoid wrapping table elements in non-table containers
- **Example**:
  ```typescript
  // ❌ BAD - Invalid HTML structure
  <StatTooltip>
    <tr>...</tr>  // <tr> inside <div> from StatTooltip
  </StatTooltip>

  // ✅ GOOD - Valid HTML structure
  <StatRow stat={stat} value={value} playerData={playerData} />
  // Where StatRow renders <tr> directly in <tbody>
  ```

### State Management Patterns

#### Zustand Store Design
- **Rule**: Design store actions to be atomic and avoid side effects that trigger during render
- **Rationale**: Prevents state updates during render phase which violate React rules
- **Implementation**: Use useEffect for side effects, keep store actions pure

#### Component State Management
- **Rule**: Each component should manage its own tooltip/UI state independently
- **Rationale**: Prevents state conflicts and makes components more reusable
- **Implementation**: Use individual useState hooks per component instance rather than shared state

### Debugging & Problem Solving

#### Evidence-Based Debugging Protocol
- **Rule**: Use systematic logging and step-by-step analysis rather than theoretical fixes
- **Rationale**: Console logs provide concrete evidence of the actual execution flow
- **Implementation**: Add strategic console.log statements to trace state changes and component lifecycle

#### Progressive Problem Escalation
- **Rule**: When initial fixes fail, systematically escalate the approach rather than repeating the same pattern
- **Rationale**: Surface-level fixes often miss root causes
- **Implementation**: Start with symptoms, then move to component structure, then to architectural changes

## Build & Development Workflow

### TypeScript & Build Safety
- **Rule**: Always run type-check and build verification after making changes
- **Rationale**: Catches type errors and build issues before they reach production
- **Implementation**: Use `npm run type-check` and `npm run build` as verification steps

### Component Architecture
- **Rule**: Separate concerns between data fetching, state management, and presentation
- **Rationale**: Makes components more testable and maintainable
- **Implementation**: Use custom hooks for data fetching, Zustand for global state, and pure components for presentation

## Quality Gates

### Pre-Deployment Checklist
1. TypeScript compilation passes (`npm run type-check`)
2. Build completes successfully (`npm run build`)
3. No React hooks ordering violations
4. No HTML validation errors
5. No hydration mismatches
6. All user-reported issues resolved

### Testing Protocol
1. Test the specific failing scenario reported by user
2. Test related functionality to ensure no regressions
3. Verify console logs show expected behavior
4. Confirm no new errors introduced
