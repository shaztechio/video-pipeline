# video-pipeline

A visual node-based pipeline tool for composing video processing workflows using [`video-cutter`](https://github.com/shaztechio/video-cutter) and [`video-stitcher`](https://github.com/shaztechio/video-stitcher).

## Overview

Create pipelines by connecting nodes on a visual canvas. Each node is an instance of a CLI tool. The pipeline is stored as a JSON spec file on disk and can be executed directly from the command line.

**Node types:**

- **Video Cutter** — cuts a video into N segments (equal count, fixed duration, or scene detection). Segments are written to a configurable output folder; defaults to an `output/` folder next to the input file.
- **Video Stitcher** — for each cutter segment, stitches fixed inputs + that segment into one output file. The output folder defaults to an `output/` folder next to the cutter's input file when there is a single cutter in the workflow.

**Data flow:** Each segment produced by a cutter node generates a separate output from the connected stitcher. For example, a cutter producing 3 segments with a stitcher configured as `[intro, EDGE(cutter), credits]` produces 3 output files — one per segment — each wrapped with the fixed inputs.

## Installation

```bash
npm install -g @shaztech/video-pipeline
```

Requires Node.js 20+ and FFmpeg installed on your system.

## Usage

### Create a new pipeline spec

```bash
video-pipeline create my-workflow
# Creates my-workflow.json in the current directory
```

### Open the visual editor

```bash
video-pipeline edit my-workflow.json
# Starts a local server and opens the editor in your browser
```

The editor lets you:
- Drag **Cutter** and **Stitcher** nodes onto the canvas
- Connect node outputs to inputs by dragging between handles
- Configure each node's parameters directly on the node
- Use the native OS file/folder picker (📁) on any file field
- Drag inputs to reorder them within a Stitcher node
- Set per-image duration overrides (✎ pencil icon on image inputs)
- Delete nodes with the **×** button that appears on hover
- Save with **⌘S** (macOS) / **Ctrl+S** (Windows/Linux) or the Save button

### Execute a pipeline

```bash
video-pipeline run my-workflow.json

# Keep intermediate temp files
video-pipeline run my-workflow.json --keep-temp

# Dry run — print execution plan without running
video-pipeline run my-workflow.json --dry-run

# Overwrite existing output files
video-pipeline run my-workflow.json --overwrite
```

### Validate a spec

```bash
video-pipeline validate my-workflow.json
```

## Pipeline Spec Format

```json
{
  "version": "1",
  "name": "my-workflow",
  "nodes": [
    {
      "id": "cutter-1",
      "type": "video-cutter",
      "label": "Cut into 3",
      "position": { "x": 100, "y": 200 },
      "config": {
        "input": "/path/to/source.mp4",
        "segments": 3,
        "duration": null,
        "sceneDetect": null,
        "output": null,
        "verify": false,
        "reEncode": false
      }
      // output null → defaults to /path/to/output/ (sibling of input)
    },
    {
      "id": "stitcher-1",
      "type": "video-stitcher",
      "label": "Stitch with intro and credits",
      "position": { "x": 500, "y": 200 },
      "config": {
        "output": "/path/to/output/folder",
        "inputOrder": [
          { "type": "fixed", "value": "/path/to/intro.mp4" },
          { "type": "edge", "nodeId": "cutter-1" },
          { "type": "fixed", "value": "/path/to/credits.png", "imageDuration": 5 }
        ],
        "imageDuration": 1,
        "bgAudio": null,
        "bgAudioVolume": 1.0
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "cutter-1",
      "sourceHandle": "output",
      "target": "stitcher-1",
      "targetHandle": "inputs"
    }
  ]
}
```

In this example the pipeline:
1. Cuts `source.mp4` into 3 equal segments
2. For each segment, stitches `intro.mp4` + segment + `credits.png` (at 5s) → 3 output files in `/path/to/output/folder/`

### `inputOrder` items

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"fixed"` \| `"edge"` | Fixed file path or upstream cutter output |
| `value` | `string` | File path (fixed items only) |
| `nodeId` | `string` | Source node id (edge items only) |
| `imageDuration` | `number` | Per-image duration override in seconds (fixed image items only) |

The `output` field on both cutter and stitcher nodes is a **folder path**. When omitted, both default to an `output/` folder in the same directory as the cutter's input file. Stitcher output files are named after the corresponding cutter segment (e.g. `seg_01_00-00-00.mp4`).

## Development

```bash
git clone https://github.com/shaztechio/video-pipeline
cd video-pipeline
npm install          # installs all workspaces and builds the editor
npm run dev          # start Vite dev server for the editor UI
```

To run the CLI locally without installing:

```bash
node packages/cli/bin.js create workflows/test
node packages/cli/bin.js edit workflows/test.json
node packages/cli/bin.js run workflows/test.json --dry-run
```
