export const origin = () => window.location.origin;
export const joinUrl = () => `${origin()}/join`;
export const voteUrl = () => `${origin()}/vote`;
/** Short form for under the QR code: host + path, no protocol. */
export const displayUrl = (url: string) => url.replace(/^https?:\/\//, "");
