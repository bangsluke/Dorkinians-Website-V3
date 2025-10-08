# Engineering Doctrine - V3 Dorkinians Website

## Table of Contents

- [Table of Contents](#table-of-contents)
- [React \& Next.js Best Practices](#react--nextjs-best-practices)
  - [Component Lifecycle \& Hooks Safety](#component-lifecycle--hooks-safety)
    - [React Hooks Ordering in Transition Components](#react-hooks-ordering-in-transition-components)
    - [HTML Validation in React Components](#html-validation-in-react-components)
  - [State Management Patterns](#state-management-patterns)
    - [Zustand Store Design](#zustand-store-design)
    - [Async Data Loading Store Pattern](#async-data-loading-store-pattern)
    - [Component State Management](#component-state-management)
  - [Async Data Loading UI State Protocol](#async-data-loading-ui-state-protocol)
  - [Debugging \& Problem Solving](#debugging--problem-solving)
    - [Evidence-Based Debugging Protocol](#evidence-based-debugging-protocol)
  - [Schema Alignment Verification Protocol](#schema-alignment-verification-protocol)
  - [Change Verification Protocol](#change-verification-protocol)
  - [Debug-First Approach Protocol](#debug-first-approach-protocol)
  - [Systematic Error Investigation Protocol](#systematic-error-investigation-protocol)
  - [Naming Consistency Enforcement Protocol](#naming-consistency-enforcement-protocol)
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
  - [Proactive UX Design Protocol](#proactive-ux-design-protocol)
  - [Fallback Mechanism Design](#fallback-mechanism-design)
  - [Iterative Correction Protocol](#iterative-correction-protocol)
  - [Documentation Verification Protocol](#documentation-verification-protocol)
- [Testing \& Data Validation](#testing--data-validation)
  - [Data Source Integrity Protocol](#data-source-integrity-protocol)
  - [Data Structure Verification Protocol](#data-structure-verification-protocol)
  - [Test Failure Logic Protocol](#test-failure-logic-protocol)
  - [TBL_TestData Validation Protocol](#tbl_testdata-validation-protocol)
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
  - [Data Corruption Investigation Protocol](#data-corruption-investigation-protocol)
  - [User Technical Guidance Priority Protocol](#user-technical-guidance-priority-protocol)
- [Database Integrity \& Data Management](#database-integrity--data-management)
  - [Data Source Verification Protocol](#data-source-verification-protocol)
  - [User Data Authority Protocol](#user-data-authority-protocol)
  - [Database Relationship Integrity Protocol](#database-relationship-integrity-protocol)
  - [Data Integrity Testing Protocol](#data-integrity-testing-protocol)
  - [Batch Processing Safety Protocol](#batch-processing-safety-protocol)
- [Environment-Specific Operations](#environment-specific-operations)
  - [Shell Environment Compatibility Protocol](#shell-environment-compatibility-protocol)
  - [Temporary File Management Protocol](#temporary-file-management-protocol)

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

#### Async Data Loading Store Pattern

- **Rule**: Implement background data loading with store-level caching to improve user experience
- **Rationale**: Pre-loading filter data eliminates loading delays and improves perceived performance
- **Implementation**:
  - Load data asynchronously on site initialization using Promise.all for parallel loading
  - Cache data in store state with loading flags to prevent duplicate API calls
  - Use data array length checks for UI state decisions rather than loading flags
- **Example**: Load seasons, teams, opposition, and competitions data in parallel on site load, cache in store, check `filterData.seasons.length === 0` for loading states

#### Component State Management

- **Rule**: Each component should manage its own tooltip/UI state independently
- **Rationale**: Prevents state conflicts and makes components more reusable
- **Implementation**: Use individual useState hooks per component instance rather than shared state

### Async Data Loading UI State Protocol

- **Rule**: When implementing background data loading, always check actual data availability (array length) rather than loading flags for UI state decisions
- **Rationale**: Loading flags may not accurately reflect data availability during async operations, causing false loading states
- **Implementation**: Use `dataArray.length === 0` instead of `!isLoading` for loading state conditions
- **Example**: `{filterData.seasons.length === 0 ? "Loading..." : <DataComponent />}` instead of `{!isLoading ? "Loading..." : <DataComponent />}`

### Debugging & Problem Solving

#### Evidence-Based Debugging Protocol

- **Rule**: Use systematic logging and step-by-step analysis rather than theoretical fixes
- **Rationale**: Console logs provide concrete evidence of the actual execution flow
- **Implementation**: Add strategic console.log statements to trace state changes and component lifecycle

### Schema Alignment Verification Protocol

- **Rule**: When making backend schema changes, proactively check and update frontend code to ensure consistency
- **Rationale**: Schema changes often require corresponding updates to frontend queries and data access patterns
- **Implementation**:
  - Review frontend chatbot queries for outdated relationship types or data sources
  - Update query patterns to match new schema definitions
  - Verify relationship directions and property access patterns
- **Example**: Backend schema changes Captain Awards relationship type → update frontend queries from `CAPTAIN` to `HAS_CAPTAIN_AWARDS`

### Change Verification Protocol

- **Rule**: Always verify that code changes are actually applied and active in the running system before considering fixes complete
- **Rationale**: Development environments with caching, hot reloading, or build systems may not immediately reflect changes, leading to false assumptions about fix effectiveness
- **Implementation**:
  - Test changes immediately after implementation using actual API calls or user scenarios
  - Restart development servers when necessary to ensure changes are loaded
  - Verify behavior matches expected changes, not just that code was modified
- **Example**: Entity extraction changes not working → restart dev server → verify with actual chatbot API calls

### Debug-First Approach Protocol

- **Rule**: Create targeted debug scripts to isolate and verify issues before making modifications to production code
- **Rationale**: Debug scripts provide controlled environments to test hypotheses and verify root causes without affecting the main system
- **Implementation**:
  - Create focused debug scripts that test specific components or patterns
  - Use debug scripts to verify assumptions before implementing fixes
  - Clean up debug scripts after successful problem resolution
- **Example**: Pattern matching issues → create debug script to test regex patterns → verify correct patterns → implement targeted fixes

### Systematic Error Investigation Protocol

- **Rule**: When users report multiple errors, investigate each error individually rather than trying to fix all at once
- **Rationale**: Each error may have a different root cause, and parallel debugging often leads to incomplete fixes and missed root causes
- **Implementation**:
  - Identify and fix the most critical issue first
  - Verify the fix works before moving to the next issue
  - Use systematic verification at each step
  - Create targeted diagnostic scripts for each specific error
- **Example**: Captain Awards + Opposition + Fixture connection errors → investigate Captain Awards first → verify fix → then investigate Opposition → verify fix → then investigate Fixture connections

### Naming Consistency Enforcement Protocol

- **Rule**: Maintain consistent naming conventions across all system components (entity extraction, priority systems, metric mapping) to prevent mismatches
- **Rationale**: Inconsistent naming between system components causes silent failures where data flows correctly but components can't find each other
- **Implementation**:
  - Audit naming conventions across all related components
  - Ensure entity extraction outputs match priority system inputs
  - Verify metric mappings use consistent naming throughout the pipeline
- **Example**: Entity extraction finds "Conceded Per Appearance" but priority system looks for "Goals Conceded Per Appearance" → align naming conventions

### Complete Data Flow Analysis Protocol

- **Rule**: When debugging complex systems, trace the entire data pipeline from input to output, not just suspected problem areas
- **Rationale**: Root causes often exist upstream from where symptoms appear, and fixing downstream issues creates fragile workarounds
- **Implementation**:
  - Map the complete data flow: input → analysis → processing → output
  - Add logging at each stage to trace data transformation
  - Identify where the data diverges from expected behavior
  - Verify each component in the pipeline independently before making changes
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

### Proactive UX Design Protocol

- **Rule**: Consider user experience and space efficiency during initial implementation, not just after user feedback
- **Rationale**: Proactive UX design prevents user corrections and improves initial user satisfaction
- **Implementation**:
  - Use grid layouts for checkbox lists to improve space efficiency
  - Consider mobile responsiveness and screen real estate during design
  - Anticipate user workflow needs and optimize accordingly
- **Example**: Implement two-column layout for seasons checkboxes during initial development rather than waiting for user feedback about space efficiency

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

### Data Corruption Investigation Protocol

- **Rule**: When users report data discrepancies, always verify the actual database state against source data before assuming logic errors
- **Rationale**: Data corruption at the node level can cause relationship queries to return incorrect results, even when the relationship creation logic is correct
- **Implementation**:
  - Create targeted diagnostic scripts to check actual database values vs expected source data
  - Use direct database queries to inspect node properties rather than assuming relationship logic is the issue
  - Investigate data corruption possibilities when unexpected values appear in database queries
- **Example**: Captain Awards showing unexpected player names → check actual CaptainsAndAwards node properties vs CSV source data

### User Technical Guidance Priority Protocol

- **Rule**: When domain experts provide specific technical insights about system behavior, prioritize those insights over theoretical analysis
- **Rationale**: Domain experts have deep understanding of the system's intended behavior and can quickly identify the correct approach
- **Implementation**:
  - When users specify exact technical requirements (e.g., "only count PLAYED_IN relationships"), implement those requirements first
  - Use theoretical analysis to validate and extend user guidance, not replace it
  - Test user-specified approaches before exploring alternative solutions
- **Example**: User says "only count PLAYED_IN relationships" → implement that specific counting method rather than investigating all relationship types

## Database Integrity & Data Management

### Data Source Verification Protocol

- **Rule**: When investigating data discrepancies, always confirm which data source the user is referencing before assuming database issues
- **Rationale**: Data synchronization issues between sources can cause apparent discrepancies that aren't actually database problems
- **Implementation**:
  - Ask users to specify which data source they're viewing when reporting discrepancies
  - Verify data source consistency before investigating database issues
  - Accept user corrections about data accuracy immediately rather than continuing to investigate
- **Example**: Database shows 27 players, user sees 14 → confirm user's data source before investigating database corruption

### User Data Authority Protocol

- **Rule**: When users correct data assumptions or report data fixes, accept their corrections immediately without further investigation
- **Rationale**: Users have authoritative knowledge of their data and corrections indicate the actual state of the system
- **Implementation**:
  - Accept user data corrections as definitive
  - Update analysis based on user corrections rather than defending previous assumptions
  - Proceed with fixes based on corrected data state
- **Example**: User reports "data was incorrect, I have now fixed it" → accept correction and re-run integrity tests

### Database Relationship Integrity Protocol

- **Rule**: When creating relationships between database nodes, ensure proper matching logic to prevent incorrect connections
- **Rationale**: Incorrect relationship creation (e.g., connecting all nodes of one type to all nodes of another type) causes massive data corruption
- **Implementation**:
  - Implement specific matching criteria for relationship creation (e.g., opposition team + home/away status)
  - Verify relationship creation logic with small test datasets before full deployment
  - Monitor relationship counts for unexpected inflation patterns
- **Example**: MatchDetail-Fixture relationships → match by opposition team and home/away status, not just date

### Data Integrity Testing Protocol

- **Rule**: Implement comprehensive data integrity tests to catch relationship corruption and data quality issues early
- **Rationale**: Data integrity issues can cause cascading failures throughout the system and are expensive to fix after deployment
- **Implementation**:
  - Create tests for maximum relationships per node, duplicate prevention, and orphaned records
  - Run integrity tests after any major data operations
  - Include tests for business rules (e.g., maximum players per match, maximum fixtures per date)
- **Example**: Test for max 18 MatchDetail nodes per Fixture, max 9 Fixtures per date, no orphaned records

### Batch Processing Safety Protocol

- **Rule**: Use smaller batch sizes and delays for large database operations to prevent timeouts and connection issues
- **Rationale**: Large batch operations can overwhelm database connections and cause operation failures
- **Implementation**:
  - Use batch sizes of 50-100 for complex operations, 1000+ for simple operations
  - Add delays between batches (200-500ms) to prevent overwhelming the database
  - Implement custom count queries for operations that can't use generic batching
- **Example**: PLAYED_IN relationship creation → use 50-record batches with 200ms delays

## Environment-Specific Operations

### Shell Environment Compatibility Protocol

- **Rule**: Always verify shell environment and use appropriate command syntax for the target system
- **Rationale**: Different shells (PowerShell, Bash, Zsh) have different syntax requirements and command chaining operators
- **Implementation**:
  - Check shell type before using command chaining operators (`&&` vs `;` vs separate commands)
  - Use PowerShell-compatible commands when working in Windows PowerShell
  - Test command syntax in the target environment before execution
- **Example**: PowerShell doesn't support `&&` → use separate `cd` and `node` commands instead of `cd && node`

### Temporary File Management Protocol

- **Rule**: Always clean up temporary development files while preserving user-requested files
- **Rationale**: Temporary files clutter the workspace and can cause confusion, but user-requested files should be preserved
- **Implementation**:
  - Identify which files were created for debugging vs. user-requested functionality
  - Delete temporary investigation scripts after successful problem resolution
  - Preserve files that users specifically requested or that provide ongoing value
- **Example**: Delete `debug-*.js` and `investigate-*.js` files, keep `test-data-integrity.js` if user requested it

> [Back to Table of Contents](#table-of-contents)
