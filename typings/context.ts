/**
 * The ID of a context.
 */
export type QwcContextId = string;


/**
 * A context.
 */
export interface QwcContext {
    id: QwcContextId;
    action: any;
    feature: any;
    geomType: any;
    changed: boolean;
    geomReadOnly: boolean;
}


/**
 * The context state.
 */
export interface QwcContextState {
    /**
     * The list of contexts.
     */
    contexts: Record<QwcContextId, QwcContext>;
    
    /**
     * The ID of the current context.
     */
    currentContext: QwcContextId;
}
