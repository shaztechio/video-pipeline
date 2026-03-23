# video-pipeline

A visual node-based pipeline tool for composing video processing workflows using [`video-cutter`](https://github.com/shaztechio/video-cutter) and [`video-stitcher`](https://github.com/shaztechio/video-stitcher).

## Overview

Create pipelines by connecting nodes on a visual canvas. Each node is an instance of a CLI tool. The pipeline is stored as a JSON spec file on disk and can be executed directly from the command line.

**Node types:**
- **Video Cutter** — cuts a video into segments (equal count, fixed duration, or scene detection)
- **Video Stitcher** — stitches multiple videos/images into one output

**Data flow:** Each segment output from a cutter node becomes an individual input to a connected stitcher node. Stitcher nodes also support fixed (static) inputs alongside variable inputs from connected cutters.

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
- Save with **⌘S** (macOS) / **Ctrl+S** (Windows/Linux) or the Save button

### Execute a pipeline

```bash
video-pipeline run my-workflow.json

# Keep intermediate temp files
video-pipeline run my-workflow.json --keep-temp

# Dry run — print execution plan without running
video-pipeline run my-workflow.json --dry-run
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
    },
    {
      "id": "stitcher-1",
      "type": "video-stitcher",
      "label": "Stitch with intro",
      "position": { "x": 500, "y": 200 },
      "config": {
        "inputs": ["/path/to/intro.mp4"],
        "output": "/path/to/final.mp4",
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
2. Stitches `intro.mp4` (fixed input) followed by all 3 segments into `final.mp4`

## Development

```bash
git clone https://github.com/shaztechio/video-pipeline
cd video-pipeline
npm install          # installs all workspaces and builds the editor
npm run dev          # start Vite dev server for the editor UI
```

To run the CLI locally:

```bash
node packages/cli/bin.js create test
node packages/cli/bin.js edit test.json
```
