declare module "../build/libherb.js" {
  const libherb: {
    default: (importObj?: any) => Promise<{
      cwrap: (name: string, returnType: string, paramTypes: string[]) => Function;
      _herb_lex: Function;
      _herb_parse: Function;
      _herb_version: Function;
      _herb_lex_json?: Function;
      _herb_extract_ruby?: Function;
    }>;
  };
  export default libherb;
}
