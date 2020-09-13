const UDFields = ['ID', 'FORM', 'LEMMA', 'UPOS', 'XPOS', 'FEATS', 'HEAD', 'DEPREL', 'DEPS', 'MISC'];

let showMenu = false,
    tokenIdx;

let parseComponent = {
    view: vnode => {
        if (sourceParse === undefined || targetParse === undefined)
            return m('div');
        const id = vnode.attrs.id;  // 'source' or 'target'
        let data = id === 'source' ? sourceParse : targetParse;
        return m(']', [
            m('div', enumerateTokens(data, id)),
            id === 'source' ? m('div') : m(menuComponent)
        ]);
    }
};

function enumerateTokens(data, id) {
    let i = 1,
        result = [],
        subjStart = parseInt(data.subj_start),
        subjEnd   = parseInt(data.subj_end),
        objStart  = parseInt(data.obj_start),
        objEnd    = parseInt(data.obj_end),
        triggerTokens = data.trigger_tokens.map(t => parseInt(t));
    for (const token of data.token) {
        let colour;
        if (i >= subjStart && i <= subjEnd)
            colour = 'goldenrod';
        else if (i === subjStart || i === subjEnd)
            colour = 'yellow';
        else if (i >= objStart && i <= objEnd)
            colour = 'salmon';
        else if (i === objStart || i === objEnd)
            colour = 'beige';
        else if (triggerTokens.indexOf(i) >= 0)
            colour = 'lightblue';
        else
            colour = 'white';
        const j = i;  // To avoid the closure trap.
        result.push(m('div',
            {
                class: 'token-button',
                style: { 'background-color': colour },
                onclick: e => {
                    if (id === 'source')
                        return;
                    e.redraw = false;
                    byId('menu').style.display = 'block';
                    byId('menu').style.left = `${e.clientX}px`;
                    byId('menu').style.top = `${e.clientY}px`;
                    tokenIdx = j;
                }
            },
            token
        ))
        i++;
    }
    return result;
}

let menuComponent = {
    view: () => {
        return m('div',
            {
                id: 'menu',
                style: {
                    display: 'none',
                    position: 'fixed',
                    'background-color': 'grey',
                    'padding': '5px',
                    'border-radius': '2px',
                    'z-index': '1000'
                }},
            [
                m('div', m('input[type=button]', {
                    value: '✕',
                    onclick: hideMenu,
                    style: {'margin-bottom': '3px'}
                })),
                m('div', m('input[type=button].endpoint-select', {
                    value: 'Subject start',
                    onclick: () => { targetParse.subj_start = tokenIdx; hideMenu(); }
                })),
                m('div', m('input[type=button].endpoint-select', {
                    value: 'Subject end',
                    onclick: () => { targetParse.subj_end = tokenIdx; hideMenu(); }
                })),
                m('div', m('input[type=button].endpoint-select', {
                    value: 'Object start',
                    onclick: () => { targetParse.obj_start = tokenIdx; hideMenu(); }
                })),
                m('div', m('input[type=button].endpoint-select', {
                    value: 'Object end',
                    onclick: () => { targetParse.obj_end = tokenIdx; hideMenu(); }
                })),
                m('div', m('input[type=button].endpoint-select', {
                    value: 'Trigger token',
                    onclick: () => {
                        const idx = targetParse.trigger_tokens.indexOf(tokenIdx);
                        if (idx >= 0) {
                            targetParse.trigger_tokens = targetParse.trigger_tokens.slice(0, idx)
                                .concat(targetParse.trigger_tokens.slice(idx+1));
                        } else {
                            targetParse.trigger_tokens.push(tokenIdx);
                            targetParse.trigger_tokens.sort((a, b) => {
                                if (parseInt(a) > parseInt(b))
                                    return 1;
                                else if (parseInt(a) < parseInt(b))
                                    return -1;
                                else
                                    return 0;
                            });
                        }
                        hideMenu();
                    }
                })),
                m('div', m('input[type=button].endpoint-select', {
                    value: 'Clear',
                    onclick: () => {
                        if (targetParse.subj_start === tokenIdx)
                            targetParse.subj_start = 'Please add';
                        if (targetParse.subj_end === tokenIdx)
                            targetParse.subj_end = 'Please add';
                        if (targetParse.obj_start === tokenIdx)
                            targetParse.obj_start = 'Please add';
                        if (targetParse.obj_end === tokenIdx)
                            targetParse.obj_end = 'Please add';
                        if (targetParse.trigger_tokens.indexOf(tokenIdx) >= 0) {
                            const idx = targetParse.trigger_tokens.indexOf(tokenIdx);
                            targetParse.trigger_tokens = targetParse.trigger_tokens.slice(0, idx)
                                .concat(targetParse.trigger_tokens.slice(idx+1));
                        }
                        hideMenu();
                    }
                }))
            ]
        );
    }
}

let hideMenu = () => { byId('menu').style.display = 'none'; m.redraw(); };

const hOffset = 5;
let network;

let UDVisualisationComponent = {
    onupdate: () => {
        let nodes = new vis.DataSet(),
            edges = new vis.DataSet(),
            container = byId('canvas'),
            data = {
                nodes: nodes,
                edges: edges
            },
            options = {
                physics:true,
                edges: {
                    smooth: {
                        type: 'curvedCCW',
                        forceDirection: 'vertical'
                    }
                },
                nodes: {
                    mass: 10,
                    fixed: true,
                    font: {
                        size: 16,
                        face: 'monospace'
                    },
                    margin: 10,
                    color: 'lightblue'
                },
            },
            network = new vis.Network(container, data, options);

        // Add nodes
        let leftOffset = -1000;
        for (const line of targetParse.wordLines) {
            let id = line.ID,
                label = line.FORM;
            nodes.add({
                id: id,
                label: label,
                x: leftOffset,
                y: 0
            });
            leftOffset = leftOffset + hOffset * line.FORM.length + 70;
        }

        // Add edges
        for (const line of targetParse.wordLines) {
            let id = line.ID,
                label = line.DEPREL;
            if (label === 'root' || label === 'punct')
                continue;
            edges.add({
                id: `${id}->${line.HEAD}`,
                arrows: 'from',
                from: id,
                to: line.HEAD,
                label: label
            });
        }

        network.fit();
    },
    view: () => m('div', {
        id: 'canvas',
        style: {
            width: '100%',
            height: '600px',
            border: '1px dotted darkgrey'
        }
    })
}

let conlluTableComponent = {
    view: () => {
        const wordLines = targetParse.wordLines;
        return m('table.ud-table', [
            m('tr', UDFields.map(field => m('th', field))),
            ...wordLines.map((wordLine, i) => m('tr', UDFields.map(
                field => m('td', m('input[type=text]', {
                    value: targetParse.wordLines[i][field],
                    disabled: ['ID', 'FORM'].indexOf(field) >= 0,
                    style: {width: '80px'},
                    oninput: e => {
                        e.redraw = false;
                        targetParse.wordLines[i][field] = e.target.value;
                    }
                }))
            )))
        ])
    }
}