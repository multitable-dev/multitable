const MAX_SIZE = 512 * 1024; // 512KB

export class RingBuffer {
  private buffer: Buffer;
  private writePos = 0;
  private full = false;

  constructor(maxSize = MAX_SIZE) {
    this.buffer = Buffer.alloc(maxSize);
  }

  write(data: string): void {
    const bytes = Buffer.from(data, 'utf8');
    // Handle wrapping - if data is larger than buffer, just keep tail
    if (bytes.length >= this.buffer.length) {
      bytes.copy(this.buffer, 0, bytes.length - this.buffer.length);
      this.writePos = 0;
      this.full = true;
      return;
    }
    const end = this.writePos + bytes.length;
    if (end <= this.buffer.length) {
      bytes.copy(this.buffer, this.writePos);
    } else {
      const firstPart = this.buffer.length - this.writePos;
      bytes.copy(this.buffer, this.writePos, 0, firstPart);
      bytes.copy(this.buffer, 0, firstPart);
      this.full = true;
    }
    this.writePos = end % this.buffer.length;
    if (end >= this.buffer.length) this.full = true;
  }

  read(): string {
    if (!this.full) {
      return this.buffer.slice(0, this.writePos).toString('utf8');
    }
    // Reconstruct ordered data from ring buffer
    const part1 = this.buffer.slice(this.writePos);
    const part2 = this.buffer.slice(0, this.writePos);
    return Buffer.concat([part1, part2]).toString('utf8');
  }

  get size(): number {
    return this.full ? this.buffer.length : this.writePos;
  }

  clear(): void {
    this.writePos = 0;
    this.full = false;
  }
}
