# Engineering Doctrine - V3 Dorkinians Website

## Table of Contents

- [Table of Contents](#table-of-contents)
- [React \& Next.js Best Practices](#react--nextjs-best-practices)
  - [Component Lifecycle \& Hooks Safety](#component-lifecycle--hooks-safety)
    - [React Hooks Ordering in Transition Components](#react-hooks-ordering-in-transition-components)
    - [HTML Validation in React Components](#html-validation-in-react-components)
  - [State Management Patterns](#state-management-patterns)
    - [Zustand Store Design](#zustand-store-design)
    - [Component State Management](#component-state-management)
  - [Debugging \& Problem Solving](#debugging--problem-solving)
    - [Evidence-Based Debugging Protocol](#evidence-based-debugging-protocol)
  - [Complete Data Flow Analysis Protocol](#complete-data-flow-analysis-protocol)
    - [Progressive Problem Escalation](#progressive-problem-escalation)
- [Build \& Development Workflow](#build--development-workflow)
  - [TypeScript \& Build Safety](#typescript--build-safety)
  - [Component Architecture](#component-architecture)
- [Documentation Standards](#documentation-standards)
  - [Markdown Documentation Protocol](#markdown-documentation-protocol)
  - [Documentation Integration Protocol](#documentation-integration-protocol)
- [Quality Gates](#quality-gates)
  - [Pre-Deployment Checklist](#pre-deployment-checklist)
  - [Testing Protocol](#testing-protocol)
  - [Test Script Safety Protocol](#test-script-safety-protocol)
  - [User Experience Validation Protocol](#user-experience-validation-protocol)
  - [Fallback Mechanism Design](#fallback-mechanism-design)
  - [Iterative Correction Protocol](#iterative-correction-protocol)
  - [Documentation Verification Protocol](#documentation-verification-protocol)
- [Testing \& Data Validation](#testing--data-validation)
  - [Data Source Integrity Protocol](#data-source-integrity-protocol)
  - [Data Structure Verification Protocol](#data-structure-verification-protocol)
  - [Test Failure Logic Protocol](#test-failure-logic-protocol)
  - [TBL\_TestData Validation Protocol](#tbl_testdata-validation-protocol)
  - [External Service Connection Protocol](#external-service-connection-protocol)
  - [Structured Error Handling Protocol](#structured-error-handling-protocol)
  - [Evidence-Based Debugging Protocol](#evidence-based-debugging-protocol-1)
  - [Data Pipeline Verification Protocol](#data-pipeline-verification-protocol)
  - [Log-First Debugging Strategy](#log-first-debugging-strategy)
  - [User Instruction Adherence Protocol](#user-instruction-adherence-protocol)
- [Natural Language Processing \& Query Analysis](#natural-language-processing--query-analysis)
  - [Context-Aware Entity Classification Protocol](#context-aware-entity-classification-protocol)
  - [User Domain Knowledge Leverage Protocol](#user-domain-knowledge-leverage-protocol)
  - [Incremental Problem Resolution Protocol](#incremental-problem-resolution-protocol)
  - [Evidence-Based Hypothesis Protocol](#evidence-based-hypothesis-protocol)
  - [Database Schema Verification Protocol](#database-schema-verification-protocol)
  - [Pipeline Order Discipline Protocol](#pipeline-order-discipline-protocol)
  - [Incremental Fix Validation Protocol](#incremental-fix-validation-protocol)
  - [Fuzzy Matching Extension Protocol](#fuzzy-matching-extension-protocol)
  - [User Experience Formatting Protocol](#user-experience-formatting-protocol)
  - [Question Analysis Priority Protocol](#question-analysis-priority-protocol)
  - [Graph Database Relationship Counting Protocol](#graph-database-relationship-counting-protocol)
  - [Systematic Data Discrepancy Analysis Protocol](#systematic-data-discrepancy-analysis-protocol)
  - [User Technical Guidance Priority Protocol](#user-technical-guidance-priority-protocol)

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

### Complete Data Flow Analysis Protocol

- **Rule**: When debugging complex systems, trace the entire data pipeline from input to output, not just suspected problem areas
- **Rationale**: Root causes often exist upstream from where symptoms appear, and fixing downstream issues creates fragile workarounds
- **Implementation**: 
  - Map the complete data flow: input → analysis → processing → output
  - Add logging at each stage to trace data transformation
  - Identify where the data diverges from expected behavior
- **Example**: Query building issues → trace from question analysis through entity extraction to query generation

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

### Test Script Safety Protocol

- **Rule**: All test scripts that create database connections or long-running processes must include timeout and proper exit handling
- **Rationale**: Scripts that hang indefinitely create poor user experience and require manual intervention to terminate
- **Implementation**:
  - Add timeout mechanisms (30-60 seconds) for long-running operations
  - Implement proper process exit handling (SIGINT, SIGTERM)
  - Clear timeouts and exit cleanly on completion or error
  - Add progress indicators for long-running operations
- **Example**: Database connection scripts → add `setTimeout(() => process.exit(1), 30000)` and `process.on('SIGINT', () => process.exit(0))`

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

## Natural Language Processing & Query Analysis

### Context-Aware Entity Classification Protocol

- **Rule**: Distinguish between "core entities" (the "who/what" being queried) and "contextual modifiers" (the "when/where/how" conditions) when assessing query complexity
- **Rationale**: Locations, timeframes, and stat types are filters/conditions, not separate entities that should count toward complexity limits
- **Implementation**:
  - Count only named entities (players, teams, oppositions, leagues) for complexity assessment
  - Treat locations ("home", "away"), timeframes (date ranges), and stat types as contextual filters
  - Only trigger clarification when single entity type exceeds limits (e.g., 4+ teams), not mixed entity types
- **Example**: "How many goals has Luk Bangs got for the 3s whilst playing at home between 20/03/2022 and 21/10/24?" = 2 named entities (1 player + 1 team) + contextual filters (location + timeframe)

### User Domain Knowledge Leverage Protocol

- **Rule**: When users provide domain-specific solutions or corrections, implement them directly rather than over-engineering alternatives
- **Rationale**: Users often have deep understanding of their domain requirements and optimal approaches
- **Implementation**:
  - Prioritize user-suggested technical approaches over complex workarounds
  - Implement user corrections immediately without defending previous decisions
  - Trust user expertise in their specific domain context
- **Example**: User corrects complexity logic → implement user's specific approach rather than creating alternative complexity assessment methods

### Incremental Problem Resolution Protocol

- **Rule**: Fix one issue completely before addressing the next - avoid parallel debugging of multiple problems
- **Rationale**: Parallel debugging often leads to incomplete fixes and missed root causes
- **Implementation**:
  - Identify and fix the most critical issue first
  - Verify the fix works before moving to the next issue
  - Use systematic verification at each step
- **Example**: Fix team detection → verify → fix question type priority → verify → fix duplicate entities → verify

### Evidence-Based Hypothesis Protocol

- **Rule**: Verify assumptions through concrete data before implementation - avoid assumption-driven solutions
- **Rationale**: Assumptions about system behavior often lead to incorrect fixes
- **Implementation**:
  - Use console logs, debug output, and code analysis to verify assumptions
  - Test hypotheses with concrete data before implementing solutions
  - Trace through actual execution flow rather than theoretical behavior
- **Example**: Assume entity counting issue → verify with actual entity extraction logs → implement targeted fix based on evidence

### Database Schema Verification Protocol

- **Rule**: Always verify database schema assumptions through actual queries before implementing business logic
- **Rationale**: Schema assumptions often lead to incorrect query construction and failed operations
- **Implementation**:
  - Run diagnostic queries to confirm data structure before building production logic
  - Verify node relationships and property locations through actual database calls
  - Test query patterns with real data before implementing complex business logic
- **Example**: Assume MatchDetail contains team/location properties → verify schema shows they're in linked Fixture nodes → update queries accordingly

### Pipeline Order Discipline Protocol

- **Rule**: In multi-stage processing systems, ensure classification happens before enhancement/fuzzy matching to prevent incorrect entity typing
- **Rationale**: Entity classification errors cascade through the entire pipeline, making them difficult to correct downstream
- **Implementation**:
  - Implement entity filtering before fuzzy matching to prevent stat types from being classified as players
  - Use similarity-based filtering to exclude recognized entity types from other classification stages
  - Ensure each processing stage has access to results from previous stages
- **Example**: Stat type words ("assits") being classified as players → implement stat type filtering before player extraction

### Incremental Fix Validation Protocol

- **Rule**: Test each change immediately to prevent compound errors and enable clear attribution of what works
- **Rationale**: Multiple simultaneous changes make it impossible to identify which fix resolved the issue
- **Implementation**:
  - Apply one fix at a time and test immediately
  - Use actual API calls and user scenarios for validation
  - Verify each fix works before proceeding to the next issue
- **Example**: Fix team mapping → test → fix time range → test → fix query routing → test

### Fuzzy Matching Extension Protocol

- **Rule**: When adding new entity types to existing fuzzy matching systems, extend the resolver interface rather than creating parallel systems
- **Rationale**: Reusing established patterns ensures consistency and reduces maintenance overhead
- **Implementation**:
  - Extend existing entity resolver interfaces to support new entity types
  - Implement similarity-based matching using established algorithms (Jaro-Winkler, Levenshtein)
  - Maintain consistent confidence thresholds and matching patterns across all entity types
- **Example**: Add stat type fuzzy matching → extend EntityNameResolver interface → implement similarity calculation for stat types

### User Experience Formatting Protocol

- **Rule**: Convert internal data formats to user-friendly formats in responses while maintaining internal consistency
- **Rationale**: Users expect familiar formats (DD/MM/YYYY) rather than technical formats (YYYY-MM-DD)
- **Implementation**:
  - Implement format conversion functions for display purposes
  - Maintain internal consistency with database/API formats
  - Apply formatting at the response generation stage, not data storage stage
- **Example**: Internal dates stored as YYYY-MM-DD → convert to DD/MM/YYYY for user responses

### Question Analysis Priority Protocol

- **Rule**: In chatbot systems, question analysis/entity extraction is often the root cause of query issues, not the query building logic itself
- **Rationale**: Incorrect entity extraction cascades through the entire system, causing downstream components to work with wrong data
- **Implementation**:
  - When query issues occur, first verify question analysis results
  - Check entity extraction accuracy before debugging query construction
  - Trace metric detection from question analysis through to query building
- **Example**: Penalty queries generating home game queries → check if "penalties scored" is being extracted as "HOME" instead of "PSC"

### Graph Database Relationship Counting Protocol

- **Rule**: When counting through relationships in graph databases, use `DISTINCT` to prevent duplicate counting from multiple relationship paths
- **Rationale**: Graph databases can have multiple relationship types between the same nodes, and counting without `DISTINCT` can inflate results by counting the same entity multiple times
- **Implementation**:
  - Use `count(DISTINCT node)` instead of `count(node)` when counting through relationships
  - Identify the specific relationship type that represents the intended count (e.g., `PLAYED_IN` for player appearances)
  - Verify that relationship conditions in schema are specific enough to prevent duplicate relationship creation
- **Example**: Player-MatchDetail relationships → use `count(DISTINCT md)` to count unique match details, not all relationship instances

### Systematic Data Discrepancy Analysis Protocol

- **Rule**: When data counts show consistent mathematical patterns (multipliers, ratios), investigate structural issues rather than logic errors
- **Rationale**: Systematic patterns in data discrepancies often indicate relationship duplication, schema issues, or counting methodology mismatches rather than query logic problems
- **Implementation**:
  - Look for consistent multipliers (e.g., 5-6x higher than expected) as indicators of structural issues
  - Trace the complete data pipeline from input through storage to query execution
  - Compare expected vs actual counts across multiple related metrics to identify patterns
- **Example**: Home games 5x higher than expected → investigate if `HAS_MATCH_DETAILS` relationships are creating duplicates

### User Technical Guidance Priority Protocol

- **Rule**: When domain experts provide specific technical insights about system behavior, prioritize those insights over theoretical analysis
- **Rationale**: Domain experts have deep understanding of the system's intended behavior and can quickly identify the correct approach
- **Implementation**:
  - When users specify exact technical requirements (e.g., "only count PLAYED_IN relationships"), implement those requirements first
  - Use theoretical analysis to validate and extend user guidance, not replace it
  - Test user-specified approaches before exploring alternative solutions
- **Example**: User says "only count PLAYED_IN relationships" → implement that specific counting method rather than investigating all relationship types

> [Back to Table of Contents](#table-of-contents)
