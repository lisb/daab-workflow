# daab-workflow

This package is a workflow engine for daab. You only need to define your workflow in YAML. daab will work according to your workflow.

## Usage

### 1. Create your daab

First of all, create a directory for your daab and initialize it.

```bash
mkdir my-daab && cd $_
daab init
```

After initialization, log in to direct.

```bash
daab login
```

### 2. Install daab-workflow

Add `daab-workflow` to your daab dependencies.

```bash
npm install daab-workflow
```

Next, create a directory in daab to place your workflow file.

```bash
mkdir workflows
```

### 3. Create your workflow

Add a new workflow file to the directory you just created.

```bash
vim workflows/hello.yml
```

More information on how to write a workflow can be found in `example/workflows/*.yml`.

### 4. Run daab

Implement `scripts/*.js` as follows.

```javascript
const { workflow } = require("daab-workflow");
module.exports = workflow('./workflows');
```

Implement `*.ts` as follows if you use TypeScript.

```typescript
import { workflow } from 'daab-workflow';
export = workflow('./workflows');
```

Finally, run daab as usual.

```bash
DISABLE_NPM_INSTALL=yes npm start
```

## Contribution

TODO
