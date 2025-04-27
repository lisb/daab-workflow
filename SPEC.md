# Workflow Specification

This document describes the specification of daab-workflow.

## Basic Structure

A workflow is defined in YAML format with the following structure:

```yaml
version: 1
name: workflow_name
defaults: default_properties
on: trigger_events
steps:
  - name: step_name
    id: step_id
    if: condition
    action: action_name
    with: action_parameters
    nowait: false
    exitFlow: false
```

## Properties

### Version
```yaml
version: 1  # Required: Currently only version 1 is supported
```
The `version` field must be specified at the top of the workflow file.

### Name
```yaml
name: workflow_name  # Required: Unique identifier for the workflow
```
The `name` field is a required string that:
- Must be unique across all workflows
- Used as the workflow identifier in logs and references

### Workflow Defaults
```yaml
defaults:
  nowait: true    # Optional: Default async behavior for all steps
```
The `defaults` field allows you to set default values that apply to all steps.

Supported properties:
- `nowait`: Controls default async execution behavior
  - `true`: Steps continue without waiting by default
  - `false`: Steps wait for completion (system default)
  - Can be overridden by individual steps

### Event Triggers
```yaml
on:
  - trigger1                # Simple trigger
  - trigger2:              # Trigger with parameters
      param: value
  - text:                  # Text message trigger
      match: "pattern"
  - schedule:              # Schedule trigger
      - cron: "* * * * *"
```

The `on` field defines workflow triggers. 

If multiple triggers are specified, the workflow will be triggered if any one of the conditions is met (OR condition).

### Trigger Formats

Triggers can be specified in several formats:

1. Single string:
```yaml
on: text
```

2. Array of triggers:
```yaml
on:
  - text
  - file
```

3. Object with parameters:
```yaml
on:
  text:
    match: "hello"
```

4. Mix of triggers:
```yaml
on:
  - workflow_dispatch
  - text:
      match: "start"
  - file:
      type: "image/*"
```

### Available triggers

- `workflow_dispatch`: Manually triggered (default if no trigger specified)
  - No parameters required

- `text`: Triggered by text messages
  ```yaml
  text:
    match: "regex_pattern"  # Required: Regex pattern to match against message text
  ```

- `file`: Triggered when a file is uploaded
  ```yaml
  file:
    name: "regex_pattern"   # Optional: Regex pattern to match against file name
    type: "regex_pattern"   # Optional: Regex pattern to match against content type
  ```
  Note: If both `name` and `type` are specified, both conditions must match (AND condition)

- `files`: Triggered when multiple files are uploaded
  ```yaml
  files:
    name: "regex_pattern"   # Optional: Regex pattern to match against all file names
    type: "regex_pattern"   # Optional: Regex pattern to match against all content types
  ```
  Note: 
  - If both `name` and `type` are specified, both conditions must match (AND condition)
  - All files must match the specified pattern (AND condition for multiple files)

- `select`: Triggered by selection responses
  ```yaml
  select:
    question:
      match: "regex_pattern"  # Optional: Match against question text
    response: 1               # Optional: Match specific response index (0-based)
    # OR
    response:
      match: "regex_pattern"  # Optional: Match against selected option text
  ```
  Note: 
  - At least one of `question` or `response` must be specified
  - If both are specified, both conditions must match (AND condition)

- `note_created`, `note_updated`, `note_deleted`: Triggered by note operations
  ```yaml
  note_created:  # (or note_updated/note_deleted)
    title: "regex_pattern"      # Optional: Match against note title
    has_attachments: true/false # Optional: Match notes with/without attachments
  ```
  Note: If both parameters are specified, both conditions must match (AND condition)

- `join`: Triggered when a bot joins a talk
  - No parameters required

- `leave`: Triggered when a bot leaves a talk
  - No parameters required

- `schedule`: Triggered by cron schedule
  ```yaml
  schedule:
    - cron: "* * * * *"  # Required: Cron expression
  ```

### Parameter Validation

1. All regex patterns are validated at workflow load time
2. Cron expressions must be valid crontab syntax
3. Response indices must be non-negative integers
4. Boolean values must be true/false

## Steps

Each step in a workflow represents an individual action to be executed. Steps are executed sequentially unless modified by `nowait` or `exitFlow` parameters.

### Required Properties

- `action`: Action to execute (see Actions section below)

### Optional Properties

- `name`: Human-readable name for the step (recommended for clarity)
- `id`: Unique identifier for referencing step results in subsequent steps
- `if`: Conditional execution
  - Supports boolean expressions
  - Can reference previous step results using templates
  - Examples:
    ```yaml
    if: true  # Always execute
    if: false # Skip step
    if: '{{ step1.response }}'  # Execute if step1 response is truthy
    if: '{{is step1.response "yes" }}'  # Execute if step1 response equals "yes"
    ```
- `with`: Action-specific parameters (see Action Parameters section)
- `nowait`: Controls async execution
  - `true`: Continue to next step without waiting
  - `false`: Wait for step completion (default)
  - Can be set globally in workflow defaults
- `exitFlow`: Controls workflow termination
  - `true`: Exit workflow after step completes
  - `false`: Continue to next step (default)

### Step Execution Order

1. Evaluate `if` condition (if specified)
2. Skip step if condition is false
3. Execute action with provided parameters
4. Store results in context if `id` is specified
5. Check `exitFlow` flag
6. Process `nowait` flag for next step

## Actions

Actions are the fundamental building blocks of workflows. They define what operations can be performed in each step.

```yaml
steps:
  - action: action_name
    with: action_parameters
```

### Action Parameters

The `with` parameter's structure depends on the action type. Each action type expects specific parameters as defined in the `DefaultActionWith` type.

#### Parameter Evaluation

Parameters in the `with` section support template expressions using Handlebars syntax:

1. String values are evaluated as templates:
```yaml
with:
  text: "Previous response was: {{ step1.response }}"
```

2. YAML structure is preserved during evaluation:
```yaml
with:
  options:
    - "Option 1: {{ step1.response }}"
    - "Option 2: {{ step2.response }}"
```

3. Template Context:
- Access to all previous step results via step IDs
- Each step result contains:
  - `responder`: Information about the user who responded
  - `response`: The actual response content
  - Additional JSON data specific to the action type

#### String-type With Parameters

When a string is provided as the `with` parameter, it is automatically parsed as YAML content:

```yaml
steps:
  # step1.response == "text"
  - action: daab:message:text
    with: |
      {{ step1.response }}: Hello

  # Above is equivalent to:
  - action: daab:message:text
    with:
      text: Hello
```

This is particularly useful when the parameters are complex or when you want to maintain better readability with multi-line strings.

Example with complex parameters:
```yaml
steps:
  # step1.response == ["First choice", "Second choice"]
  - action: daab:message:select
    with: |
      question: Please select an option
      options:
        {{#step1.response}}
        - {{.}}
        {{/step1.response}}
```

### Built-in Message Actions

#### Text Messages (`daab:message:text`)
Send text messages to users or talks.
```yaml
action: daab:message:text
with:
  text: "Message content with optional {{ templates }}"  # Required
  to: "recipient_name"                                  # Optional: defaults to original sender
```

#### File Upload (`daab:message:file`)
Upload a single file.
```yaml
action: daab:message:file
with:
  path: "path/to/file"                # Required: File path
  name: "custom_filename.ext"         # Optional: Override filename
  type: "content/type"               # Optional: Override content type
  text: "Optional message"           # Optional: Accompanying message
  to: "recipient_name"               # Optional: Target recipient
```

#### Multiple Files Upload (`daab:message:files`)
Upload multiple files at once.
```yaml
action: daab:message:files
with:
  path:                              # Required: Array of file paths
    - "path/to/file1"
    - "path/to/file2"
  name:                              # Optional: Override filenames
    - "custom_filename1.ext"
    - "custom_filename2.ext"
  type:                             # Optional: Override content types
    - "content/type1"
    - "content/type2"
  text: "Optional message"          # Optional: Accompanying message
  to: "recipient_name"              # Optional: Target recipient
```

#### Selection Message (`daab:message:select`)
Present users with multiple choice options.
```yaml
action: daab:message:select
with:
  question: "What would you like to do?"  # Required: Question text
  options:                                # Required: Array of options
    - "Option 1"
    - "Option 2"
    - "Option 3"
  to: "recipient_name"                    # Optional: Target recipient
```

#### Yes/No Message (`daab:message:yesno`)
Present users with a yes/no question.
```yaml
action: daab:message:yesno
with:
  question: "Do you approve?"       # Required: Question text
  to: "recipient_name"             # Optional: Target recipient
```

#### Task Message (`daab:message:task`)
Create a task for users.
```yaml
action: daab:message:task
with:
  title: "Task title"              # Required: Task title
  to: "recipient_name"             # Optional: Target recipient
```

### Custom Actions

Custom actions extend workflow capabilities by implementing external Node.js modules:

```yaml
action: custom:module-name
with:
  param1: value1
  param2: value2
```

#### Implementation Requirements

1. Module Structure:
```javascript
export default async function(
  args, // Parameters passed with the `with` property
  res // (Option) Response object from lisb-hubot
) {
  // Implementation
}
```

2. Module Location:
- Must be accessible in Node.js module path
- Can be local file or npm package

3. Error Handling:
- Should throw errors for invalid parameters
- Should return ActionResponse for successful execution
- May return undefined if no response needed

4. Response Format:
```javascript
  { data: {/* the result of the custom action */} }
```

#### Custom Action Example

Implementation (fullname.js):
```javascript
export default async function(args) {
  const { firstName, lastName } = args;
  // Process parameters
  const fullName = `${firstName} ${lastName}`;
  return { data: fullName };
}
```

Usage in workflow:
```yaml
steps:
  - name: "Create fullname"
    id: fullname
    action: custom:../example/scripts/fullname
    with:
      firstName: "John"
      lastName: "Doe"
    nowait: true

  - name: "Output fullname"
    action: daab:message:text
    with:
      text: "Fullname: {{ fullName.response }}"
```

#### Error Handling

1. Missing Required Parameters
- Actions will throw error if required parameters are missing
- Workflow execution stops unless error is caught

2. Invalid Parameter Types
- Actions validate parameter types
- Throws TypeError for invalid types

3. Network/IO Errors
- File operations may throw IO errors
- Message sending may throw network errors
- Custom actions should handle their errors

4. Response Errors
- Invalid responses are caught and logged
- Workflow continues based on error handling config

## Variables and Templates

Variables from previous steps can be referenced using `{{ }}` syntax. [Handlebars](https://handlebarsjs.com/) expressions can be used for more complex templating. You can also use [Handlebars helpers](https://github.com/helpers/handlebars-helpers) for advanced scenarios.

Example:
```yaml
text: |
  Responder: {{ step1.responder.displayName }}
  Answer: {{ step1.response }}
```

- `{{ step_id.responder.displayName }}`: Responder's display name
- `{{ step_id.response }}`: Response from a step

## Conditions

The `if` property supports template expressions:
```yaml
if: '{{ step1.response }}'
if: '{{ not step1.response }}'
```

## Complete Examples

### Basic Echo Workflow
```yaml
version: 1
name: Echo text
steps:
  - name: input text
    id: step1
    action: daab:message:text
    with:
      text: Please enter something.

- name: echo text
    action: daab:message:text
    with:
      text: ECHO >> {{ step1.response }}
```
### Approval Workflow
```yaml
version: 1
name: Collaboration (2 people)
steps:
  - name: Input
    id: step1
    action: daab:message:text
    with:
      text: Please submit the request details.

- name: Send to Approver
    id: step2
    action: daab:message:select
    with:
      question: |
         Please review the request details.
         Requester: {{ step1.responder.displayName }}
         Request Details: {{ step1.response }}
      options:
        - Approve
        - Reject
      to: approver_name
```
