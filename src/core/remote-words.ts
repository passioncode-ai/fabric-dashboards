// FD-199, FD-200: the sentence a console that cannot open on the other machine says, by what its key allows there.
// Pure, so the window and the tests share it without the console's terminal.
export function remoteRefusal(detail: string | null | undefined): 'console.remote.view' | 'console.remote.denied' | 'console.remote.unreachable' | 'console.remote.noRoute' | 'console.remote.noFolder' {
  // FD-203: the other machine answered, and has neither the chosen folder nor the repository's checkout.
  if (detail === 'no-folder') return 'console.remote.noFolder';
  return detail === 'view' ? 'console.remote.view' : detail === 'denied' ? 'console.remote.denied' : detail === 'unreachable' ? 'console.remote.unreachable' : 'console.remote.noRoute';
}
