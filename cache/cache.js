class LFUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map(); // Map to store key-value pairs
    this.frequency = new Map(); // Map to store key-frequency pairs
  }

  get(key) {
    if (this.cache.has(key)) {
      // Increment the frequency of the accessed key
      this.incrementFrequency(key);
      return this.cache.get(key);
    }
    return null; // Key not found in cache
  }

  put(key, value) {
    // if the capacity is negative nothing will happen
    if (this.capacity <= 0) return;

    // If key already exists, update its value and increment frequency
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.incrementFrequency(key);
      return;
    }

    // If cache is full, remove the least frequently used item
    if (this.cache.size >= this.capacity) {
      this.removeLeastFrequent();
    }

    // Insert the new key-value pair with frequency 1
    this.cache.set(key, value);
    this.frequency.set(key, 1);
  }

  incrementFrequency(key) {
    // Increment the frequency of the accessed key
    const freq = this.frequency.get(key) + 1;
    this.frequency.set(key, freq);
  }

  removeLeastFrequent() {
    let leastFreqKey;
    let minFreq = Infinity;
    // Find the key with the lowest frequency
    for (const [key, freq] of this.frequency) {
      if (freq < minFreq) {
        minFreq = freq;
        leastFreqKey = key;
      }
    }
    // Remove the least frequently used key from both maps
    this.cache.delete(leastFreqKey);
    this.frequency.delete(leastFreqKey);
  }

  remove(key) {
    // Remove the entry corresponding to the key from the cache
    this.cache.delete(key);
    this.frequency.delete(key);
  }
}

module.exports = LFUCache;
