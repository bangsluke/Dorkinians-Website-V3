# Engineering Doctrine - V3 Dorkinians Website

## Table of Contents

- [React & Next.js Best Practices](#react--nextjs-best-practices)
  - [Component Lifecycle & Hooks Safety](#component-lifecycle--hooks-safety)
  - [State Management Patterns](#state-management-patterns)
  - [Debugging & Problem Solving](#debugging--problem-solving)
- [Build & Development Workflow](#build--development-workflow)
- [Documentation Standards](#documentation-standards)
- [Quality Gates](#quality-gates)
- [Testing & Data Validation](#testing--data-validation)

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

## Documentation Standards

### Markdown Documentation Protocol

- **Rule**: When creating or updating documentation, always follow the user's established formatting standards from the beginning
- **Rationale**: Prevents the need for user corrections and ensures consistency across all documentation
- **Implementation**:
  - Include comprehensive Table of Contents with all subsections (H2, H3, H4) and proper anchor links
  - Add "Back to Table of Contents" navigation links between all major sections
  - Follow the user's specific markdown structure requirements consistently

### Documentation Integration Protocol

- **Rule**: When merging content from multiple sources, ensure all structural elements are comprehensive and match established standards
- **Rationale**: Prevents incomplete integration that requires user enhancement
- **Implementation**:
  - Anticipate the full depth of documentation structure needed
  - Include all subsections in table of contents, not just major sections
  - Verify complete integration before considering the task complete

## Quality Gates

### Pre-Deployment Checklist

1. TypeScript compilation passes (`npm run type-check`)
2. Build completes successfully (`npm run build`)
3. No React hooks ordering violations
4. No HTML validation errors
5. No hydration mismatches
6. All user-reported issues resolved
7. Documentation follows established formatting standards
8. User experience validation completed (actual user-visible results confirmed)
9. Fallback mechanisms tested and functional
10. User corrections addressed with comprehensive solutions

### Testing Protocol

1. Test the specific failing scenario reported by user
2. Test related functionality to ensure no regressions
3. Verify console logs show expected behavior
4. Confirm no new errors introduced

### User Experience Validation Protocol

- **Rule**: Technical execution success must be validated against actual user experience, not just system metrics
- **Rationale**: Scripts can run successfully while failing to deliver the expected user-visible results
- **Implementation**:
  - For email reports: Verify actual email content structure, not just delivery success
  - For UI changes: Confirm user-visible changes, not just component rendering
  - For data generation: Distinguish between sample data and comprehensive coverage requirements
- **Example**: Email script reports "sent successfully" but user reports "table not showing" - investigate actual email content

### Fallback Mechanism Design

- **Rule**: For unreliable parsing operations, implement robust fallback strategies that ensure core functionality
- **Rationale**: Complex output parsing (Jest verbose, API responses) is inherently fragile and can fail silently
- **Implementation**:
  - Always provide comprehensive fallback data generation when parsing fails
  - Design fallbacks to match the full scope of expected results, not just sample data
  - Log fallback activation clearly for debugging purposes
- **Example**: Jest output parsing fails → generate comprehensive test details covering all scenarios and players

### Iterative Correction Protocol

- **Rule**: Treat user corrections as critical failure signals requiring immediate investigation and course correction
- **Rationale**: User feedback indicates the actual success criteria, not technical metrics
- **Implementation**:
  - When user corrects "still not working", immediately investigate the gap between technical success and user experience
  - Don't repeat the same approach that failed; escalate to more comprehensive solutions
  - Validate fixes against user confirmation, not just technical execution

### Documentation Verification Protocol

1. Table of Contents includes all subsections with proper anchor links
2. Navigation links are present between all major sections
3. Formatting matches user's established standards
4. No redundant or duplicate documentation files remain

## Testing & Data Validation

### Data Source Integrity Protocol

- **Rule**: Never implement hardcoded fallback values when the user explicitly requires dynamic data sourcing
- **Rationale**: Hardcoded values violate the fundamental requirement for real data validation and can mask data access issues
- **Implementation**:
  - Always find a way to access the real data source, even if it requires alternative approaches
  - When TypeScript imports fail, implement direct HTTP fetching to CSV/API sources
  - If data access fails, report the failure clearly rather than using placeholder data
- **Example**: CSV import fails → implement direct HTTP fetch to Google Sheets CSV URL

### Data Structure Verification Protocol

- **Rule**: Before making assumptions about data field names or structure, always inspect the actual data first
- **Rationale**: Field names in external data sources may not match JavaScript naming conventions
- **Implementation**:
  - Add strategic logging to examine actual data structure
  - Use flexible field access patterns (case-insensitive, multiple naming conventions)
  - Verify field names match exactly what's in the source data
- **Example**: CSV headers are `'PLAYER NAME'` not `playerName` or `PlayerName`

### Test Failure Logic Protocol

- **Rule**: Tests with missing, null, undefined, or "N/A" values must be marked as FAILED, not PASSED
- **Rationale**: Missing data indicates a problem that should be flagged, not ignored
- **Implementation**:
  - Implement strict validation functions that mark invalid data as failed
  - Never allow tests to pass when expected data is unavailable
  - Distinguish between "no data available" (FAILED) and "data available but zero" (PASSED)
- **Example**: `getValueOrFail(value) => value === 'N/A' ? {status: 'FAILED'} : {status: 'PASSED'}`

### TBL_TestData Validation Protocol

- **Rule**: All test data must be sourced from the actual TBL_TestData CSV, with no hardcoded values allowed in the testing setup
- **Rationale**: Ensures test results reflect real data accuracy and prevents false positives from placeholder values
- **Implementation**:
  - Source all expected values from the authoritative CSV data
  - Implement robust CSV parsing that handles the actual data structure
  - Generate comprehensive test coverage using real data fields
- **Example**: Use `playerData.APP` from CSV rather than hardcoded `172` for Luke Bangs appearances

### External Service Connection Protocol

- **Rule**: Always verify connection state before executing operations on external services (databases, APIs, etc.)
- **Rationale**: External service failures cause cascading errors that are difficult to debug without proper connection verification
- **Implementation**:
  - Add connection checks at the entry point of service operations
  - Return structured error responses when connections fail
  - Log connection attempts and failures for debugging
- **Example**: Neo4j queries fail with "driver not initialized" → add `await neo4jService.connect()` before query execution

### Structured Error Handling Protocol

- **Rule**: Return structured error objects with context rather than `null` or generic failures
- **Rationale**: Structured errors enable proper error handling downstream and provide debugging context
- **Implementation**:
  - Return error objects with `type: "error"`, `error: message`, and `cypherQuery: "N/A"`
  - Handle error types explicitly in response generation
  - Preserve error context through the call chain
- **Example**: `queryPlayerData` returns `{type: "error", data: [], error: "Connection failed"}` instead of `null`

### Evidence-Based Debugging Protocol

- **Rule**: Use systematic analysis (logs, targeted searches) before creating debugging tools
- **Rationale**: Log analysis reveals patterns and root causes more efficiently than creating multiple debug scripts
- **Implementation**:
  - Analyze existing logs and error patterns first
  - Use grep/search tools to identify specific failure points
  - Create targeted fixes based on evidence rather than assumptions
- **Example**: Analyze test failure logs to identify "No Cypher Query" pattern before creating debug scripts

### Data Pipeline Verification Protocol

- **Rule**: Before fixing data processing issues, always verify the complete pipeline from source to usage
- **Rationale**: Data processing failures can occur at any stage (parsing, access, transformation, usage) and fixing the wrong stage wastes time
- **Implementation**:
  - Trace data flow: source → parsing → access → usage
  - Verify each stage independently before implementing fixes
  - Use concrete data inspection rather than assumptions about data structure
- **Example**: CSV parsing issue → verify actual CSV headers, then parsing logic, then data access patterns

### Log-First Debugging Strategy

- **Rule**: Implement comprehensive logging before attempting fixes, then analyze logs to identify root causes
- **Rationale**: Logs provide concrete evidence of actual execution flow, enabling precise problem identification
- **Implementation**:
  - Add detailed logging at each stage of data processing
  - Analyze log outputs to identify where the process breaks down
  - Use log evidence to guide targeted fixes rather than theoretical solutions
- **Example**: Add CSV parsing logs, data access logs, and test execution logs to trace the complete flow

### User Instruction Adherence Protocol

- **Rule**: When users provide specific debugging methodologies, follow them exactly rather than implementing alternative approaches
- **Rationale**: Users often have domain knowledge about the most effective debugging approaches for their specific systems
- **Implementation**:
  - Follow user-specified debugging steps precisely
  - Implement user-requested logging and analysis approaches
  - Avoid substituting alternative methods without user approval
- **Example**: User requests "use the generated log files to debug" → implement comprehensive logging and analyze logs rather than creating new debug scripts
