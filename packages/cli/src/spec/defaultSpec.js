export function createDefaultSpec(name = 'my-pipeline') {
  return {
    version: '1',
    name,
    nodes: [],
    edges: []
  }
}
