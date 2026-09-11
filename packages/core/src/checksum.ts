/** A checksum algorithm a {@link ChecksumComputer} can implement. */
export type ChecksumAlgorithm = "MD5" | "SHA-256" | "CRC32";

/**
 * Optional integrity-checking abstraction a transport or provider package may use to compute a
 * checksum for a chunk before/after transfer. Core ships no implementation.
 */
export type ChecksumComputer = {
  readonly algorithm: ChecksumAlgorithm;
  compute(data: ArrayBuffer): Promise<string>;
};
