// FD-19: machine-written English reasons — from the shared reading package (descriptor checks, the
// well-known answer, token files, the usage report), from Node (network and file errors) and from
// this app (feed, login, link refusals) — read in Russian in a Russian interface. A table of the
// known sentences, applied to a reason's text parameters; anything not in it stays as written,
// because a wrong translation is worse than an English one. No Node imports: the renderer uses it.

type Rule = [RegExp, (...m: string[]) => string];

const RULES: Rule[] = [
  // descriptor (packages/service-host/src/descriptor.ts)
  [/^placement must be local or remote$/, () => 'placement должен быть local или remote'],
  [/^missing (\S+)$/, (_, k) => `нет поля ${k}`],
  [/^protocol must be (\S+), not (.+)$/, (_, p, v) => `protocol должен быть ${p}, а не ${v}`],
  [/^(id|instance) must be lowercase letters, digits and dashes$/, (_, k) => `${k}: только строчные латинские буквы, цифры и дефисы`],
  [/^name must be 1 to 80 characters$/, () => 'name: от 1 до 80 символов'],
  [/^origin must be http:\/\/127\.0\.0\.1:<port>$/, () => 'origin должен быть http://127.0.0.1:<порт>'],
  [/^a remote origin must be https:\/\/<dns-name>\[:<port>\] with no path, query or IP literal$/, () => 'удалённый origin — https://<имя>[:<порт>], без пути, параметров и IP-адреса'],
  [/^a remote service cannot live on the reserved name (.+)$/, (_, n) => `удалённый сервис не может жить на зарезервированном имени ${n}`],
  [/^the origin port is out of range$/, () => 'порт в origin вне допустимого диапазона'],
  [/^auth\.tokenFile must be an absolute or ~\/ path$/, () => 'auth.tokenFile — абсолютный путь или путь от ~/'],
  [/^auth\.header is not a valid header name$/, () => 'auth.header — недопустимое имя заголовка'],
  [/^auth\.scheme must be Bearer or none$/, () => 'auth.scheme должен быть Bearer или none'],
  [/^a custom auth header carries the raw token: auth\.scheme must be none$/, () => 'свой заголовок несёт токен как есть: auth.scheme должен быть none'],
  [/^lifecycle\.manager must be launchd or none$/, () => 'lifecycle.manager должен быть launchd или none'],
  [/^a launchd service declares lifecycle\.(label|plist)$/, (_, k) => `сервис под launchd указывает lifecycle.${k}`],
  [/^a remote service is supervised by its platform: lifecycle\.manager must be none$/, () => 'удалённым сервисом управляет его платформа: lifecycle.manager должен быть none'],
  [/^a remote service has no launchd (\S+)$/, (_, f) => `у удалённого сервиса нет launchd ${f}`],
  [/^paths\.data must be an absolute or ~\/ path$/, () => 'paths.data — абсолютный путь или путь от ~/'],
  [/^paths\.logs must list absolute or ~\/ paths$/, () => 'paths.logs — список абсолютных путей или путей от ~/'],
  [/^a remote service declares no update command$/, () => 'удалённый сервис не объявляет команду update'],
  [/^commands must be an object$/, () => 'commands должен быть объектом'],
  [/^unknown command (\S+)$/, (_, c) => `неизвестная команда ${c}`],
  [/^command (\S+) must be an argument array, not a shell string$/, (_, c) => `команда ${c} — массив аргументов, а не строка для shell`],
  [/^command (\S+) must start with an absolute or ~\/ executable$/, (_, c) => `команда ${c} начинается с исполняемого файла по абсолютному пути или от ~/`],
  [/^the file is named (\S+) but describes (\S+)$/, (_, f, k) => `файл называется ${f}, но описывает ${k}`],
  [/^missing paths$/, () => 'нет поля paths'],
  // the well-known answer (health.ts)
  [/^the answer is not a JSON object$/, () => 'ответ — не JSON-объект'],
  [/^the answer is not JSON$/, () => 'ответ — не JSON'],
  [/^protocol is (.+)$/, (_, v) => `protocol равен ${v}`],
  [/^service identity is missing$/, () => 'нет идентификатора сервиса'],
  [/^process\.pid is missing$/, () => 'нет process.pid'],
  [/^status (.+) is not a protocol status$/, (_, v) => `статус ${v} не из протокола`],
  [/^degraded is missing$/, () => 'нет поля degraded'],
  [/^surfaces\.events is missing$/, () => 'нет surfaces.events'],
  [/^HTTP (\d+) on (\S+)$/, (_, c, p) => `HTTP ${c} на ${p}`],
  [/^HTTP (\d+): the service answered with a redirect, which a host does not follow$/, (_, c) => `HTTP ${c}: сервис ответил перенаправлением, по которому хост не переходит`],
  [/^response larger than 2 MB$/, () => 'ответ больше 2 МБ'],
  [/^no answer within (\d+) ms$/, (_, n) => `нет ответа за ${n} мс`],
  [/^origin (\S+) is not http:\/\/127\.0\.0\.1:<port>, nor a remote https origin$/, (_, o) => `origin ${o} — не http://127.0.0.1:<порт> и не удалённый https`],
  // token files (health.ts readToken)
  [/^the token file (.+) is a symlink$/, (_, f) => `файл токена ${f} — символическая ссылка`],
  [/^the token file (.+) belongs to another user$/, (_, f) => `файл токена ${f} принадлежит другому пользователю`],
  [/^the token file (.+) is readable by others; set mode 0600$/, (_, f) => `файл токена ${f} доступен другим; поставьте права 0600`],
  [/^the token file (.+) holds no usable token$/, (_, f) => `в файле токена ${f} нет пригодного токена`],
  // this app's feeds (probe.ts)
  [/^the service refused the token \(HTTP (\d+)\)$/, (_, c) => `сервис отклонил токен (HTTP ${c})`],
  [/^HTTP (\d+) from the events feed$/, (_, c) => `HTTP ${c} от ленты событий`],
  [/^the events feed did not return an events page$/, () => 'лента событий не вернула страницу событий'],
  [/^the service refused a login code \(HTTP (\d+)\)$/, (_, c) => `сервис отклонил код входа (HTTP ${c})`],
  [/^the login code answer is malformed$/, () => 'ответ с кодом входа некорректен'],
  [/^HTTP (\d+) from the usage report$/, (_, c) => `HTTP ${c} от отчёта о расходах`],
  [/^the usage report is not JSON$/, () => 'отчёт о расходах — не JSON'],
  [/^the usage report is malformed: (.+)$/, (_, p) => `отчёт о расходах некорректен: ${machineRu(p)}`],
  // the usage report (usage.ts)
  [/^(\S+) is not a count$/, (_, f) => `${f} — не количество`],
  [/^(\S+)\.costUsd is neither a non-negative number nor null$/, (_, f) => `${f}.costUsd — не неотрицательное число и не null`],
  [/^(\S+) has more unpriced calls than calls$/, (_, f) => `в ${f} вызовов без цены больше, чем вызовов`],
  [/^(\S+) prices calls that it says are unpriced$/, (_, f) => `${f} называет цену вызовов, которые сам считает без цены`],
  [/^the report is for (\S+), not (\S+)$/, (_, a, b) => `отчёт о сервисе ${a}, а не ${b}`],
  [/^currency (.+) is not USD$/, (_, c) => `валюта ${c} — не USD`],
  [/^generatedAt is missing$/, () => 'нет generatedAt'],
  [/^days is not a list of at most 31$/, () => 'days — не список не длиннее 31'],
  [/^(\S+)\.date is not a date$/, (_, f) => `${f}.date — не дата`],
  [/^(\S+) does not run forward$/, (_, f) => `${f} идут не по порядку`],
  [/^(\S+)\.byModel is not a list of at most 32$/, (_, f) => `${f}.byModel — не список не длиннее 32`],
  [/^(\S+) has totals but names no model$/, (_, f) => `в ${f} есть итоги, но не названа модель`],
  [/^(\S+) names no provider and model$/, (_, f) => `${f} не называет провайдера и модель`],
  [/^budget is malformed$/, () => 'бюджет записан некорректно'],
  // Node: network and files
  [/^connect ECONNREFUSED (\S+)$/, (_, a) => `соединение отклонено (${a})`],
  [/^getaddrinfo ENOTFOUND (\S+)$/, (_, h) => `имя ${h} не найдено`],
  [/^read ECONNRESET$/, () => 'соединение разорвано'],
  [/^socket hang up$/, () => 'соединение оборвалось'],
  [/^certificate has expired$/, () => 'срок сертификата истёк'],
  [/^self[- ]signed certificate.*$/, () => 'самоподписанный сертификат'],
  [/^Hostname\/IP does not match certificate's altnames.*$/, () => 'имя не совпадает с сертификатом'],
  [/^ENOENT: no such file or directory, \w+ '(.+)'$/, (_, f) => `файла нет: ${f}`],
  [/^EACCES: permission denied, \w+ '(.+)'$/, (_, f) => `нет доступа: ${f}`],
  // link refusals (deeplink.ts)
  [/^not a URL$/, () => 'это не адрес'],
  [/^no installed service (.+)$/, (_, k) => `нет установленного сервиса ${k}`],
  [/^path must be a path on the service, starting with one \/$/, () => 'путь должен быть путём на сервисе и начинаться с одного /'],
  [/^not a service key (.+?)(: .*)?$/, (_, k) => `это не ключ сервиса ${k}: id.instance, строчные латинские буквы, цифры и дефисы`],
];

/** The Russian of one machine sentence, or the sentence itself when it is not known. A text of several
 *  sentences joined by "; " is read piece by piece. */
export function machineRu(text: string): string {
  const parts = text.split('; ');
  if (parts.length > 1 && !/^the token file .+ is readable by others$/.test(parts[0]!)) return parts.map(machineRu).join('; ');
  for (const [re, fn] of RULES) {
    const m = re.exec(text);
    if (m) return fn(...m);
  }
  return text;
}
