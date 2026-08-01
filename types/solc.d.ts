/** solc-js ships no types; the compile script only needs its one entry point. */
declare module "solc" {
  const solc: { compile(input: string): string; version(): string };
  export default solc;
}
