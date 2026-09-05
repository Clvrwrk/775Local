/** Reuse an uncertain request key only for the identical normalized command.
 * @param {{fingerprint: string, key: string} | null} previous
 * @param {unknown} command
 * @param {() => string} createKey
 */
export function retryIdentity(previous, command, createKey) {
  const fingerprint = JSON.stringify(command);
  return previous?.fingerprint === fingerprint ? previous : { fingerprint, key: createKey() };
}
