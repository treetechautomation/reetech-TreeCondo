export class FirestorePermissionError extends Error {
  operation: string;
  path: string;

  constructor({
    operation,
    path,
  }: {
    operation: string;
    path: string;
  }) {
    super(
      `Missing or insufficient permissions for Firestore operation "${operation}" on path "${path}".`
    );
    this.name = "FirestorePermissionError";
    this.operation = operation;
    this.path = path;
  }
}
