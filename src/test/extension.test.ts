import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Context Commander', () => {
  test('extension activates', async () => {
    const ext = vscode.extensions.getExtension('shadowbq.context-commander');
    assert.ok(ext);
    await ext!.activate();
    assert.strictEqual(ext!.isActive, true);
  });
});
