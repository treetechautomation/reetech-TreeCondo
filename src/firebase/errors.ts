"use client";


'use client';
import { getAuth, type User } from 'firebase/auth';

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

interface FirebaseAuthToken {
  name: string | null;
  picture?: string | null;
  email: string | null;
  email_verified: boolean;
  phone_number: string | null;
  sub: string;
  firebase: {
    identities: Record<string, any>;
    sign_in_provider: string;
    tenant: string | null;
  };
  // Custom claims são mescladas aqui
  [key: string]: any; 
  claims_unavailable?: boolean;
}

export interface FirebaseAuthObject {
  uid: string;
  token: FirebaseAuthToken;
}

export interface SecurityRuleRequest {
  auth: FirebaseAuthObject | null;
  method: string;
  path: string;
  resource?: {
    data: any;
  };
}

/**
 * Builds a security-rule-compliant auth object from the Firebase User.
 * This is the SYNCHRONOUS version, used for listeners where we cannot await.
 * It does not fetch custom claims.
 * @param currentUser The currently authenticated Firebase user.
 * @returns An object that mirrors request.auth in security rules, or null.
 */
function buildAuthObjectSync(currentUser: User | null): FirebaseAuthObject | null {
  if (!currentUser) {
    return null;
  }

  const providerData = currentUser.providerData[0];

  const token: FirebaseAuthToken = {
    name: currentUser.displayName,
    picture: currentUser.photoURL,
    email: currentUser.email,
    email_verified: currentUser.emailVerified,
    phone_number: currentUser.phoneNumber,
    sub: currentUser.uid,
    firebase: {
      identities: providerData ? {[providerData.providerId]: [providerData.uid]} : {},
      sign_in_provider: providerData?.providerId || 'custom',
      tenant: currentUser.tenantId,
    },
    // Mark claims as unavailable in sync mode
    claims_unavailable: true,
  };

  return {
    uid: currentUser.uid,
    token: token,
  };
}


/**
 * Builds a security-rule-compliant auth object from the Firebase User, including custom claims.
 * This is the ASYNCHRONOUS version.
 * @param currentUser The currently authenticated Firebase user.
 * @returns A promise that resolves to an object mirroring request.auth, or null.
 */
async function buildAuthObjectAsync(currentUser: User | null): Promise<FirebaseAuthObject | null> {
    if (!currentUser) {
        return null;
    }

    try {
        // Force refresh to get latest claims set by backend functions.
        const tokenResult = await currentUser.getIdTokenResult(true);
        
        const token: FirebaseAuthToken = {
            // Mescla todas as claims no nível raiz do token, como nas regras de segurança
            ...tokenResult.claims,
            name: currentUser.displayName,
            picture: currentUser.photoURL,
            email: currentUser.email,
            email_verified: currentUser.emailVerified,
            phone_number: currentUser.phoneNumber,
            sub: currentUser.uid,
            firebase: {
                identities: tokenResult.claims.firebase?.identities || {},
                sign_in_provider: tokenResult.claims.firebase?.sign_in_provider || 'custom',
                tenant: currentUser.tenantId,
            },
        };
        
        return {
            uid: currentUser.uid,
            token: token,
        };

    } catch (error) {
        console.error("Error fetching user token with claims:", error);
        // Fallback to sync version if token fetching fails
        const syncAuth = buildAuthObjectSync(currentUser);
        if (syncAuth) {
          syncAuth.token.claims_unavailable = true;
        }
        return syncAuth;
    }
}


/**
 * Builds the final, formatted error message for the LLM.
 * @param requestObject The simulated request object.
 * @returns A string containing the error message and the JSON payload.
 */
function buildErrorMessage(requestObject: SecurityRuleRequest): string {
  return `Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
${JSON.stringify(requestObject, null, 2)}`;
}

/**
 * A custom error class designed to be consumed by an LLM for debugging.
 * It structures the error information to mimic the request object
 * available in Firestore Security Rules.
 */
export class FirestorePermissionError extends Error {
  public readonly request: SecurityRuleRequest;

  /**
   * Use this constructor for SYNCHRONOUS contexts like onSnapshot listeners.
   * It will NOT contain custom claims.
   * For async operations, use the `createFirestorePermissionError` factory.
   */
  constructor(context: SecurityRuleContext) {
    let authObject: FirebaseAuthObject | null = null;
    try {
      const firebaseAuth = getAuth();
      authObject = buildAuthObjectSync(firebaseAuth.currentUser);
    } catch {
      // This will catch errors if the Firebase app is not yet initialized.
    }
    
    const requestObject: SecurityRuleRequest = {
        auth: authObject,
        method: context.operation,
        path: `/databases/(default)/documents/${context.path}`,
        resource: context.requestResourceData ? { data: context.requestResourceData } : undefined,
    };
    
    super(buildErrorMessage(requestObject));
    this.name = 'FirestorePermissionError';
    this.request = requestObject;
  }
}

async function buildRequestObjectAsync(context: SecurityRuleContext): Promise<SecurityRuleRequest> {
    let authObject: FirebaseAuthObject | null = null;
    try {
        const firebaseAuth = getAuth();
        authObject = await buildAuthObjectAsync(firebaseAuth.currentUser);
    } catch {
        // Errors during auth object creation are handled inside buildAuthObjectAsync
    }

    return {
        auth: authObject,
        method: context.operation,
        path: `/databases/(default)/documents/${context.path}`,
        resource: context.requestResourceData ? { data: context.requestResourceData } : undefined,
    };
}


/**
 * ASYNCHRONOUS factory to create a FirestorePermissionError enriched with custom claims.
 * Use this in `async` functions (create, update, delete, transactions).
 * @param context The context of the failed Firestore operation.
 * @returns A promise that resolves to a FirestorePermissionError instance.
 */
export async function createFirestorePermissionError(context: SecurityRuleContext): Promise<FirestorePermissionError> {
    
    const requestObject = await buildRequestObjectAsync(context);

    // We create a generic Error to capture the stack trace from the call site.
    const errorForStackTrace = new Error();

    // Create an instance of the error class but bypass its constructor logic
    // by passing a minimal context. This is to ensure we return the correct type.
    const permissionError = new FirestorePermissionError({operation: context.operation, path: context.path});

    // Manually set the properties with the async-built request and correct message
    (permissionError as any).request = requestObject;
    permissionError.message = buildErrorMessage(requestObject);

    // Restore the original stack trace if available
    if (errorForStackTrace.stack) {
        permissionError.stack = errorForStackTrace.stack;
    }
    
    return permissionError;
}
