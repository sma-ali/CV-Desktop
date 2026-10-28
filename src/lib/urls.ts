// Libellé lisible d'une adresse : sans protocole, sans « www. » ni barre finale
// (« https://www.linkedin.com/in/smaali » devient « linkedin.com/in/smaali »).
export function displayUrl(url: string): string {
  const { hostname, pathname } = new URL(url);
  const host = hostname.replace(/^www\./, '');
  const path = pathname.replace(/\/+$/, '');
  return `${host}${path}`;
}
