/**
 * Represents a simple last-in-first-out (LIFO) non-generic collection of objects.
 */
export class Stack<T> {
  private storage: T[] = [];

  /**
   * Inserts an object at the top of the
   * @param item The item to push onto the Stack.
   */
  push(item: T): void {
    this.storage.push(item);
  }

  /**
   * Removes and returns the object at the top of the Stack.
   * @returns The object removed from the top of the Stack.
   */
  pop(): T | undefined {
    return this.storage.pop();
  }

  /**
   * Returns the object at the top of the Stack without removing it.
   * @returns The object at the top of the Stack.
   */
  peek(): T | undefined {
    return this.storage[this.size() - 1];
  }

  /**
   * Gets the number of items in the Stack.
   * @returns The number of items in the Stack.
   */
  size(): number {
    return this.storage.length;
  }
}
