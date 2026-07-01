const MATH_FUNCTIONS = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    sec: x => 1 / Math.cos(x),
    sgn: Math.sign,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    exp: Math.exp,
    ln: Math.log,
    log: Math.log,
    sqrt: Math.sqrt,
    abs: Math.abs,
};

function tokenize(expression) {
    const tokens = [];
    const regex = /\s*([A-Za-z]+|\d*\.\d+|\d+|[()+\-*/^,])\s*/g;
    let match;
    while ((match = regex.exec(expression)) !== null) {
        const token = match[1];
        if (!token) continue;
        tokens.push(token);
    }
    return tokens;
}

function parseExpression(tokens) {
    let position = 0;

    function peek() {
        return tokens[position];
    }

    function consume(expected) {
        const token = tokens[position];
        if (expected && token !== expected) {
            throw new Error(`Esperado '${expected}' mas encontrado '${token}'`);
        }
        position += 1;
        return token;
    }

    function parsePrimary() {
        const token = peek();
        if (!token) {
            throw new Error('Expressão incompleta');
        }

        if (token === '(') {
            consume('(');
            const value = parseAddSub();
            consume(')');
            return value;
        }

        if (/^\d*\.\d+$/.test(token) || /^\d+$/.test(token)) {
            consume();
            return { type: 'number', value: parseFloat(token) };
        }

        if (/^[A-Za-z]+$/.test(token)) {
            consume();
            const name = token.toLowerCase();
            if (peek() === '(') {
                consume('(');
                const arg = parseAddSub();
                consume(')');
                return { type: 'function', name, arg };
            }
            if (name === 'pi') {
                return { type: 'number', value: Math.PI };
            }
            if (name === 'e') {
                return { type: 'number', value: Math.E };
            }
            return { type: 'variable', name };
        }

        throw new Error(`Token inesperado: ${token}`);
    }

    function parseUnary() {
        const token = peek();
        if (token === '+' || token === '-') {
            consume();
            const operand = parseUnary();
            if (token === '-') {
                return { type: 'unary', op: '-', arg: operand };
            }
            return operand;
        }
        return parsePrimary();
    }

    function parseExponent() {
        let node = parseUnary();
        while (peek() === '^') {
            consume('^');
            const right = parseExponent();
            node = { type: 'binary', op: '^', left: node, right };
        }
        return node;
    }

    function parseMulDiv() {
        let node = parseExponent();
        while (peek() === '*' || peek() === '/') {
            const op = consume();
            const right = parseExponent();
            node = { type: 'binary', op, left: node, right };
        }
        return node;
    }

    function parseAddSub() {
        let node = parseMulDiv();
        while (peek() === '+' || peek() === '-') {
            const op = consume();
            const right = parseMulDiv();
            node = { type: 'binary', op, left: node, right };
        }
        return node;
    }

    const ast = parseAddSub();
    if (position < tokens.length) {
        throw new Error(`Token inesperado no fim: ${peek()}`);
    }
    return ast;
}

function parse(input) {
    if (typeof input !== 'string') return null;
    const cleaned = input.replace(/\s+/g, '');
    if (!cleaned) {
        throw new Error('Expressão vazia');
    }
    return parseExpression(tokenize(cleaned));
}

function evaluate(node, variables) {
    switch (node.type) {
        case 'number':
            return node.value;
        case 'variable':
            return variables[node.name] ?? 0;
        case 'unary':
            return -evaluate(node.arg, variables);
        case 'binary': {
            const left = evaluate(node.left, variables);
            const right = evaluate(node.right, variables);
            switch (node.op) {
                case '+': return left + right;
                case '-': return left - right;
                case '*': return left * right;
                case '/': return left / right;
                case '^': return Math.pow(left, right);
                default: return NaN;
            }
        }
        case 'function': {
            const value = evaluate(node.arg, variables);
            const func = MATH_FUNCTIONS[node.name];
            if (typeof func !== 'function') {
                throw new Error(`Função desconhecida: ${node.name}`);
            }
            return func(value);
        }
        default:
            return NaN;
    }
}

function simplify(node) {
    if (!node) return node;
    switch (node.type) {
        case 'number':
        case 'variable':
            return node;
        case 'unary': {
            const arg = simplify(node.arg);
            if (arg.type === 'number') {
                return { type: 'number', value: -arg.value };
            }
            return { type: 'unary', op: node.op, arg };
        }
        case 'binary': {
            const left = simplify(node.left);
            const right = simplify(node.right);
            if (left.type === 'number' && right.type === 'number') {
                return { type: 'number', value: evaluate({ type: 'binary', op: node.op, left, right }, {}) };
            }
            if (node.op === '+' && left.type === 'number' && left.value === 0) return right;
            if (node.op === '+' && right.type === 'number' && right.value === 0) return left;
            if (node.op === '-' && right.type === 'number' && right.value === 0) return left;
            if (node.op === '*' && (left.type === 'number' && left.value === 0 || right.type === 'number' && right.value === 0)) return { type: 'number', value: 0 };
            if (node.op === '*' && left.type === 'number' && left.value === 1) return right;
            if (node.op === '*' && right.type === 'number' && right.value === 1) return left;
            if (node.op === '^' && right.type === 'number' && right.value === 1) return left;
            if (node.op === '^' && right.type === 'number' && right.value === 0) return { type: 'number', value: 1 };
            return { type: 'binary', op: node.op, left, right };
        }
        case 'function':
            return { type: 'function', name: node.name, arg: simplify(node.arg) };
        default:
            return node;
    }
}

function derivative(node, variable) {
    switch (node.type) {
        case 'number':
            return { type: 'number', value: 0 };
        case 'variable':
            return { type: 'number', value: node.name === variable ? 1 : 0 };
        case 'unary': {
            return { type: 'unary', op: '-', arg: derivative(node.arg, variable) };
        }
        case 'binary': {
            const u = node.left;
            const v = node.right;
            const du = derivative(u, variable);
            const dv = derivative(v, variable);
            switch (node.op) {
                case '+':
                    return simplify({ type: 'binary', op: '+', left: du, right: dv });
                case '-':
                    return simplify({ type: 'binary', op: '-', left: du, right: dv });
                case '*':
                    return simplify({
                        type: 'binary',
                        op: '+',
                        left: { type: 'binary', op: '*', left: du, right: v },
                        right: { type: 'binary', op: '*', left: u, right: dv },
                    });
                case '/':
                    return simplify({
                        type: 'binary',
                        op: '/',
                        left: { type: 'binary', op: '-', left: { type: 'binary', op: '*', left: du, right: v }, right: { type: 'binary', op: '*', left: u, right: dv } },
                        right: { type: 'binary', op: '^', left: v, right: { type: 'number', value: 2 } },
                    });
                case '^': {
                    if (v.type === 'number') {
                        return simplify({
                            type: 'binary',
                            op: '*',
                            left: { type: 'binary', op: '*', left: v, right: { type: 'binary', op: '^', left: u, right: { type: 'number', value: v.value - 1 } } },
                            right: du,
                        });
                    }
                    if (u.type === 'number') {
                        return simplify({
                            type: 'binary',
                            op: '*',
                            left: { type: 'binary', op: '*', left: { type: 'binary', op: '^', left: u, right: v }, right: { type: 'function', name: 'ln', arg: u } },
                            right: dv,
                        });
                    }
                    return simplify({
                        type: 'binary',
                        op: '*',
                        left: { type: 'binary', op: '^', left: u, right: v },
                        right: {
                            type: 'binary',
                            op: '*',
                            left: derivative({ type: 'binary', op: '*', left: v, right: { type: 'function', name: 'ln', arg: u } }, variable),
                            right: { type: 'number', value: 1 },
                        },
                    });
                }
                default:
                    return { type: 'number', value: 0 };
            }
        }
        case 'function': {
            const inner = node.arg;
            const din = derivative(inner, variable);
            switch (node.name) {
                case 'sin':
                    return simplify({ type: 'binary', op: '*', left: { type: 'function', name: 'cos', arg: inner }, right: din });
                case 'cos':
                    return simplify({ type: 'binary', op: '*', left: { type: 'unary', op: '-', arg: { type: 'function', name: 'sin', arg: inner } }, right: din });
                case 'tan':
                    return simplify({ type: 'binary', op: '*', left: { type: 'binary', op: '^', left: { type: 'function', name: 'sec', arg: inner }, right: { type: 'number', value: 2 } }, right: din });
                case 'exp':
                    return simplify({ type: 'binary', op: '*', left: { type: 'function', name: 'exp', arg: inner }, right: din });
                case 'ln':
                case 'log':
                    return simplify({ type: 'binary', op: '*', left: { type: 'binary', op: '/', left: din, right: inner }, right: { type: 'number', value: 1 } });
                case 'sqrt':
                    return simplify({ type: 'binary', op: '*', left: { type: 'binary', op: '/', left: din, right: { type: 'binary', op: '*', left: { type: 'number', value: 2 }, right: { type: 'function', name: 'sqrt', arg: inner } } }, right: { type: 'number', value: 1 } });
                case 'abs':
                    return simplify({ type: 'binary', op: '*', left: { type: 'function', name: 'sgn', arg: inner }, right: din });
                default:
                    return { type: 'number', value: 0 };
            }
        }
        default:
            return { type: 'number', value: 0 };
    }
}

function astToString(node) {
    if (!node) return '0';
    switch (node.type) {
        case 'number':
            return formatNumber(node.value);
        case 'variable':
            return node.name;
        case 'unary':
            return `-${wrap(node.arg, 3)}`;
        case 'binary': {
            const op = node.op;
            if (op === '+' || op === '-') {
                return `${wrap(node.left, 1)} ${op} ${wrap(node.right, 1)}`;
            }
            if (op === '*') {
                return `${wrap(node.left, 2)} * ${wrap(node.right, 2)}`;
            }
            if (op === '/') {
                return `${wrap(node.left, 2)} / ${wrap(node.right, 2)}`;
            }
            if (op === '^') {
                return `${wrap(node.left, 4)}^${wrap(node.right, 4)}`;
            }
            return `${wrap(node.left, 1)} ${op} ${wrap(node.right, 1)}`;
        }
        case 'function':
            return `${node.name}(${astToString(node.arg)})`;
        default:
            return '';
    }
}

function wrap(node, precedence) {
    if (node.type === 'binary') {
        const prec = precedenceFor(node.op);
        if (prec < precedence) {
            return `(${astToString(node)})`;
        }
    }
    return astToString(node);
}

function precedenceFor(op) {
    if (op === '+' || op === '-') return 1;
    if (op === '*' || op === '/') return 2;
    if (op === '^') return 4;
    return 0;
}

function formatNumber(value) {
    if (Number.isFinite(value)) {
        if (Math.round(value) === value) return value.toString();
        // Aumentar precisão para 12 dígitos significativos
        return Number.parseFloat(value.toPrecision(12)).toString();
    }
    return String(value);
}

function integral(node, variable) {
    switch (node.type) {
        case 'number':
            return { type: 'binary', op: '*', left: node, right: { type: 'variable', name: variable } };
        case 'variable':
            if (node.name === variable) {
                return { type: 'binary', op: '/', left: { type: 'binary', op: '^', left: node, right: { type: 'number', value: 2 } }, right: { type: 'number', value: 2 } };
            }
            return { type: 'binary', op: '*', left: node, right: { type: 'variable', name: variable } };
        case 'binary': {
            const u = node.left;
            const v = node.right;
            switch (node.op) {
                case '+':
                    return simplify({ type: 'binary', op: '+', left: integral(u, variable), right: integral(v, variable) });
                case '-':
                    return simplify({ type: 'binary', op: '-', left: integral(u, variable), right: integral(v, variable) });
                case '*':
                    if (u.type === 'number') {
                        return simplify({ type: 'binary', op: '*', left: u, right: integral(v, variable) });
                    }
                    if (v.type === 'number') {
                        return simplify({ type: 'binary', op: '*', left: v, right: integral(u, variable) });
                    }
                    break;
                case '^':
                    if (u.type === 'variable' && u.name === variable && v.type === 'number' && v.value !== -1) {
                        return simplify({ type: 'binary', op: '/', left: { type: 'binary', op: '^', left: u, right: { type: 'number', value: v.value + 1 } }, right: { type: 'number', value: v.value + 1 } });
                    }
                    if (u.type === 'variable' && u.name === variable && v.type === 'number' && v.value === -1) {
                        return { type: 'function', name: 'ln', arg: { type: 'variable', name: variable } };
                    }
                    break;
                default:
                    break;
            }
            break;
        }
        case 'function': {
            const inner = node.arg;
            if (node.name === 'sin') {
                return simplify({ type: 'unary', op: '-', arg: { type: 'function', name: 'cos', arg: inner } });
            }
            if (node.name === 'cos') {
                return simplify({ type: 'function', name: 'sin', arg: inner });
            }
            if (node.name === 'exp') {
                if (inner.type === 'binary' && inner.op === '*' && inner.left.type === 'number' && inner.right.type === 'variable' && inner.right.name === variable) {
                    return simplify({ type: 'binary', op: '/', left: { type: 'function', name: 'exp', arg: inner }, right: inner.left });
                }
                if (inner.type === 'variable' && inner.name === variable) {
                    return { type: 'function', name: 'exp', arg: inner };
                }
            }
            if (node.name === 'ln' || node.name === 'log') {
                if (inner.type === 'variable' && inner.name === variable) {
                    return simplify({ type: 'binary', op: '/', left: { type: 'binary', op: '^', left: inner, right: { type: 'number', value: 2 } }, right: { type: 'number', value: 2 } });
                }
            }
            break;
        }
    }
    return null;
}

function numericIntegral(ast, variable, a, b) {
    const n = 1000;
    const h = (b - a) / n;
    let sum = 0;
    for (let i = 0; i <= n; i += 1) {
        const x = a + i * h;
        const weight = i === 0 || i === n ? 1 : i % 2 === 0 ? 2 : 4;
        const value = evaluate(ast, { [variable]: x });
        sum += weight * value;
    }
    return (sum * h) / 3;
}

function computeLimit(expression, variable, approach) {
    const ast = parse(expression);
    const t = approach.trim().toLowerCase();
    const inf = ['inf', '+inf', '∞', '+∞', 'infinito', '+infinito'];
    const negInf = ['-inf', '-∞', '-infinito'];

    if (inf.includes(t) || negInf.includes(t)) {
        const sign = inf.includes(t) ? 1 : -1;
        const sample = sign * 1e6;
        const value = evaluate(ast, { [variable]: sample });
        if (!Number.isFinite(value)) {
            return sign === 1 ? '∞' : '-∞';
        }
        return formatNumber(value);
    }

    const point = parseFloat(approach);
    if (Number.isNaN(point)) {
        throw new Error('Valor de tendência inválido');
    }

    const hValues = [1e-1, 1e-2, 1e-3, 1e-4, 1e-5];
    const results = hValues.map(h => {
        const left = evaluate(ast, { [variable]: point - h });
        const right = evaluate(ast, { [variable]: point + h });
        return { left, right };
    });

    const left = results[results.length - 1].left;
    const right = results[results.length - 1].right;
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
        return 'Infinito ou indefinido';
    }
    if (Math.abs(left - right) < Math.max(1e-6, Math.abs(left) * 1e-4)) {
        return formatNumber((left + right) / 2);
    }
    return `não existe limite finito`;
}

function calculateFormula(tipo) {
    if (tipo === 'limites') {
        const funcao = document.getElementById('f-limite').value;
        const variavel = document.getElementById('limite-v').value.trim() || 'x';
        const tende = document.getElementById('limite-tende').value;
        if (!funcao || !tende) {
            return 'Por favor, preencha a função e a tendência.';
        }
        try {
            const limite = computeLimit(funcao, variavel, tende);
            return `lim (${funcao}) quando ${variavel} → ${tende} = ${limite}`;
        } catch (error) {
            return `Erro: ${error.message}`;
        }
    }

    if (tipo === 'derivadas') {
        const funcao = document.getElementById('f-derivada').value;
        const variavel = document.getElementById('derivada-v').value.trim() || 'x';
        const ordem = parseInt(document.getElementById('derivada-ordem').value, 10) || 1;
        if (!funcao) {
            return 'Por favor, insira a função.';
        }
        try {
            let ast = parse(funcao);
            let resultado = `<strong>f(${variavel}) = ${funcao}</strong><br><br>`;
            
            // Mostrar cada derivada
            for (let i = 1; i <= ordem; i += 1) {
                ast = simplify(derivative(ast, variavel));
                let superscript = '';
                if (i === 1) superscript = "'";
                else if (i === 2) superscript = "''";
                else if (i === 3) superscript = "'''";
                else superscript = "'" + i.toString();
                
                resultado += `<strong>f${superscript}(${variavel}) = ${astToString(ast)}</strong>`;
                if (i < ordem) resultado += '<br><br>';
            }
            
            return resultado;
        } catch (error) {
            return `Erro: ${error.message}`;
        }
    }

    if (tipo === 'integrais') {
        const funcao = document.getElementById('f-integral').value;
        const variavel = document.getElementById('integral-v').value.trim() || 'x';
        const inf = document.getElementById('int-inf').value.trim();
        const sup = document.getElementById('int-sup').value.trim();
        if (!funcao) {
            return 'Por favor, insira a função.';
        }
        try {
            const ast = parse(funcao);
            if (inf && sup) {
                const a = parseFloat(inf);
                const b = parseFloat(sup);
                if (Number.isNaN(a) || Number.isNaN(b)) {
                    return 'Limites de integração inválidos.';
                }
                const valor = numericIntegral(ast, variavel, a, b);
                return `∫ de ${inf} até ${sup} ${funcao} d${variavel} = ${formatNumber(valor)}`;
            }
            const integralAST = integral(ast, variavel);
            if (!integralAST) {
                return `∫ ${funcao} d${variavel} = [Integral não suportada simbolicamente]`;
            }
            return `∫ ${funcao} d${variavel} = ${astToString(integralAST)} + C`;
        } catch (error) {
            return `Erro: ${error.message}`;
        }
    }

    return 'Tipo desconhecido';
}

function mudarAba(idAba) {
    document.querySelectorAll('.aba-btn').forEach(btn => btn.classList.remove('ativa'));
    document.querySelectorAll('.conteudo-aba').forEach(conteudo => conteudo.classList.remove('ativo'));

    const botaoClicado = Array.from(document.querySelectorAll('.aba-btn')).find(btn => btn.textContent.toLowerCase().includes(idAba.substring(0, 3)));
    if (botaoClicado) botaoClicado.classList.add('ativa');

    document.getElementById(idAba).classList.add('ativo');
    document.getElementById('resultado').innerHTML = 'Insira os dados e clique em calcular...';
}

function calcular(tipo) {
    const painelResultado = document.getElementById('resultado');
    const resultado = calculateFormula(tipo);
    painelResultado.innerHTML = resultado;
}
