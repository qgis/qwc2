// This is required because of the following error:
// TextEncoder is not defined in jsdom/whatwg-url
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextDecoder, TextEncoder });
