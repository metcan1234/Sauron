class ElementCache {
  constructor() {
    this.cache = new Map();
    this.embeddings = new Map();
  }

  clear(sessionId) {
    if (sessionId) {
      this.cache.delete(sessionId);
      this.embeddings.delete(sessionId);
    }
  }

  get(sessionId) {
    if (!this.cache.has(sessionId)) {
      this.cache.set(sessionId, []);
    }
    return this.cache.get(sessionId);
  }

  set(sessionId, elements) {
    this.cache.set(sessionId, elements);
  }

  add(sessionId, element) {
    const elements = this.get(sessionId);
    const existing = elements.findIndex(
      (e) => e.text === element.text && this._isNear(e.bbox, element.bbox)
    );
    if (existing >= 0) {
      elements[existing] = { ...elements[existing], ...element, updatedAt: Date.now() };
    } else {
      elements.push({ ...element, createdAt: Date.now(), updatedAt: Date.now() });
    }
  }

  addBatch(sessionId, newElements) {
    for (const element of newElements) {
      this.add(sessionId, element);
    }
  }

  getEmbeddings(sessionId) {
    if (!this.embeddings.has(sessionId)) {
      this.embeddings.set(sessionId, new Map());
    }
    return this.embeddings.get(sessionId);
  }

  setEmbedding(sessionId, key, embedding) {
    const embMap = this.getEmbeddings(sessionId);
    embMap.set(key, embedding);
  }

  getEmbedding(sessionId, key) {
    return this.getEmbeddings(sessionId).get(key);
  }

  findNearby(sessionId, bbox, tolerance = 50) {
    const elements = this.get(sessionId);
    return elements.filter((e) => this._isNear(e.bbox, bbox, tolerance));
  }

  findByText(sessionId, text, fuzzy = true) {
    const elements = this.get(sessionId);
    const lowerText = text.toLowerCase();
    if (fuzzy) {
      return elements.filter((e) => e.text && e.text.toLowerCase().includes(lowerText));
    }
    return elements.filter((e) => e.text && e.text.toLowerCase() === lowerText);
  }

  _normalizeBbox(bbox) {
    if (!bbox) return null;
    const x = bbox.x !== undefined ? bbox.x : (bbox.x0 !== undefined ? bbox.x0 : undefined);
    const y = bbox.y !== undefined ? bbox.y : (bbox.y0 !== undefined ? bbox.y0 : undefined);
    const width = bbox.width !== undefined ? bbox.width : (bbox.x1 !== undefined && x !== undefined ? bbox.x1 - x : undefined);
    const height = bbox.height !== undefined ? bbox.height : (bbox.y1 !== undefined && y !== undefined ? bbox.y1 - y : undefined);
    if (x === undefined || y === undefined || width === undefined || height === undefined) return null;
    return { x, y, width, height };
  }

  _isNear(a, b, tolerance = 30) {
    const na = this._normalizeBbox(a);
    const nb = this._normalizeBbox(b);
    if (!na || !nb) return false;
    return (
      Math.abs(na.x - nb.x) <= tolerance &&
      Math.abs(na.y - nb.y) <= tolerance &&
      Math.abs(na.width - nb.width) <= tolerance &&
      Math.abs(na.height - nb.height) <= tolerance
    );
  }
}

module.exports = { ElementCache };