/** Chrome Extension API 类型声明（Web App 侧最小子集） */
declare namespace chrome {
  namespace runtime {
    function sendMessage(
      extensionId: string,
      message: any,
    ): Promise<any>;
  }
}
