declare module "jsoneditor" {
  const JSONEditor: new (...args: unknown[]) => {
    destroy?: () => void;
    getText: () => string;
    setText: (text: string) => void;
  };
  export default JSONEditor;
}
