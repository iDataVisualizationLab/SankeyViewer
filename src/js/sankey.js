// data type {key, value, order(optional), data(extra data)}


let Sankey = function(){
    let tooltip = d3.tip().attr('class', 'd3-tip').html(function (d){return `${d}`})
    let graphicopt = {
        margin: {top: 20, right: 20, bottom: 20, left: 100},
        width: 1400,
        height: 700,
        'max-height': 500,
        scalezoom: 1,
        zoom:d3.zoom(),
        widthView: function () {
            return this.width * this.scalezoom
        },
        heightView: function () {
            return this.height * this.scalezoom
        },
        widthG: function () {
            return this.widthView() - this.margin.left - this.margin.right
        },
        heightG: function () {
            return this.heightView() - this.margin.top - this.margin.bottom
        },
        centerX: function () {
            return this.margin.left+this.widthG()/2;
        },
        centerY: function () {
            return this.margin.top+this.heightG()/2;
        },
        hi: 12,
        padding: 0,
        animationTime:1000,
        color:{},
        maxPerUnit: 32
    };

    let maindiv='#ganttLayout';
    let isFreeze= false;
    let data=[],times=[],nodes=[],_links=[],graph_={},linksBySource=[],colorBy='name',metrics={},sankeyComputeSelected,main_svg,g,link_g,r=0;
    const area = d3.area().defined(d=>!!d).curve(d3.bumpX).x(d=>d[0])
    let onFinishDraw = [];
    let onLoadingFunc = ()=>{};
    // used to assign nodes color by group
    let colorByName = d3.scaleOrdinal(["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#bcbd22", "#17becf", "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5", "#c49c94", "#f7b6d2", "#dbdb8d", "#9edae5"])
    let color = d3.scaleOrdinal(["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#bcbd22", "#17becf", "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5", "#c49c94", "#f7b6d2", "#dbdb8d", "#9edae5"])
    let _color = d3.scaleOrdinal(["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#bcbd22", "#17becf", "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5", "#c49c94", "#f7b6d2", "#dbdb8d", "#9edae5"])
    let colorCluster = d3.scaleOrdinal(d3.schemeCategory20);
    let getColorScale = _getColorScale_byName;
    function _getColorScale_byName (d){
        debugger
        if (d.isShareUser)
            return '#696969';
        else
            return _color (d.name??'');
    }
    function getCluster(d){
        const index = d.layer;
        let groups = {};
        Object.keys(d.comp).forEach(k=>{
            if(metrics) {
                const com = metrics[k];
                if (com && com[index]){
                    const _val = com[index].cluster;
                    if(_val!==undefined) {
                        if(!groups[_val])
                            groups[_val] = 0;
                        groups[_val]++;
                    }
                }
            }
        });
        const val = Object.keys(groups).length;
        return val>1?undefined:(val===1?Object.keys(groups)[0]:'outlier');
    }
    function getValue(d){
        const index = d.layer;
        const _key = +(colorBy??'0');
        let sum = 0;
        let total = 0;
        Object.keys(d.comp).forEach(k=>{
            if(metrics) {
                const com = metrics[k];
                if (com && com[index]){
                    const _val = com[index][_key];
                    if(_val!==undefined) {
                        sum += _val*d.comp[k];
                        total += d.comp[k]
                    }
                }
            }
        });
        const val = sum/total;
        return (total)?val:undefined;
    }
    function _getColorScale_byCluster(d){
        const val = this.getCluster(d);
        return val?colorCluster(val):'white'
    }
    function _getColorScale_byValue (d){
        const val = this.getValue(d);
        return  ''+(color(val))
    }
    let master={};
    let radius,x,y;
    let nodeSort = undefined;
    let sankey = d3.sankey()
        .nodeWidth(0.1)
        // .nodeAlign(d3.sankeynodeAlign)
        .nodePadding(5);
    master.mouseover = [];
    master.mouseover.dict={};
    master.mouseout = [];
    master.mouseout.dict={};
    master.click = [];
    master.click.dict={};
    master.mouseoverAdd = function(id,func){
        if (master.mouseover.dict[id]!==undefined)
            master.mouseover[master.mouseover.dict[id]] = func;
        else {
            master.mouseover.push(func)
            master.mouseover.dict[id] = master.mouseover.length-1;
        }
    }
    master.mouseoutAdd = function(id,func){
        if (master.mouseout.dict[id]!==undefined)
            master.mouseout[master.mouseout.dict[id]] = func;
        else {
            master.mouseout.push(func)
            master.mouseout.dict[id] = master.mouseout.length-1;
        }
    }
    master.clickAdd = function(id,func){
        if (master.click.dict[id]!==undefined)
            master.click[master.click.dict[id]] = func;
        else {
            master.click.push(func)
            master.click.dict[id] = master.click.length-1;
        }
    }
    master.sortFunc = function(a,b){return a.order-b.order};
    master.updateTimeHandle = function (time){
        if (time){
            g.select('.timeHandleHolder').interrupt();
            g.select('.timeHandleHolder').classed('hide',false).transition().duration(graphicopt.animationTime).attr('transform',`translate(${x(time)},0)`);
        }else
            g.select('.timeHandleHolder').classed('hide',true)
    }
    master.draw = function() {
        if (isFreeze)
            freezeHandle();

        _color = colorByName??d3.scaleOrdinal(["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#bcbd22", "#17becf", "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5", "#c49c94", "#f7b6d2", "#dbdb8d", "#9edae5"]);
        color = color??_color;
        if(color){
            switch (colorBy) {
                case 'name':
                    getColorScale = _getColorScale_byName;
                    break;
                case 'cluster':
                    getColorScale = _getColorScale_byCluster;
                    break;
                default:
                    getColorScale = _getColorScale_byValue;
            }
        }


        main_svg.select('#timeClip rect').attr('height',graphicopt.heightG());
        g.select('.timeHandleHolder').classed('hide',true).attr('transform','translate(0,0)')
            .select('.timeStick').attr('y2',graphicopt.heightG())
        y = d3.scalePoint().range([0,graphicopt.heightG()]).padding(graphicopt.padding);
        // x = d3.scaleTime().domain(graphicopt.range||[d3.min(data,d=>d.range[0]),d3.max(data,d=>d.range[1])]).range([0,graphicopt.widthG()]);
        // data.sort(master.sortFunc);
        y.domain(data.map(d=>d.key));
        // let sizeScale = d3.scaleSqrt().domain(d3.extent(_.flatten(data.map(d=>d.value.map(d=>d.names.length))))).range([1,graphicopt.hi/2*1.2]);
        // let range= sizeScale.domain();

        data.forEach((d,i)=>{
            d.order = i;
            d.relatedNode = [];
        });
        let drawArea = g.select('.drawArea')//.attr('clip-path','url(#timeClip)');
        //
        let keys = Layout.timespan;
        times = keys;
        x = d3.scaleTime().domain([keys[0],_.last(keys)]).range([0,graphicopt.widthG()]);
        let width = x.range()[1]-x.range()[0];

        let graph = (() => {
            let index = -1;
            let nodes = [];
            const nodeByKey = new Map;
            const indexByKey = new Map;
            const nodeLabel = new Map;
            let links = [];
            const nodeList = {};
            console.time('create nodes');
            keys.forEach((_k, ki) => {
                const k = '' + _k;
                for (const d of data) {
                    if (d[k]) {
                        const item = d[k];
                        const text = getUserName(item);
                        const key = JSON.stringify([k, text]);
                        if ((graphicopt.showShareUser && (!(item && item.length > 1))) || nodeByKey.has(key))
                            continue; // return

                        const node = {
                            name: text,
                            time: _k,
                            layer: ki,
                            _key: key,
                            relatedLinks: [],
                            element: item,
                            id: ++index
                        };
                        if (!nodeLabel.has(text)) {
                            node.first = true;
                            node.childNodes = [];
                            nodeLabel.set(text, node);
                            nodeList[text] = [];
                            node.isShareUser = !!(item && (item.length > 1));
                            node.maxIndex = ki;
                            node.maxval = 0;
                            node.drawData = [];
                            node.comp = {}
                            node.comp[d.key] = true;


                            nodes.push(node);
                            nodeByKey.set(key, node);
                            indexByKey.set(key, index);
                            nodeList[text].push(node);
                        } else {
                            node.isShareUser = !!(item && item.length > 1);
                            node.parentNode = nodeLabel.get(text).id;
                            node.comp = {}
                            node.comp[d.key] = true;
                            nodes.push(node);
                            // if (nodeByKey.has(key)) continue;
                            nodeByKey.set(key, node);
                            indexByKey.set(key, index);
                            nodeList[text].push(node);
                        }
                    }
                }
            });
            console.timeEnd('create nodes');
            console.time('create links');
            const maxLimit = graphicopt.maxPerUnit;
            const mapOfSankey = {};
            debugger
            // nodes = _.shuffle(nodes)
            for (let i = 1; i < keys.length; ++i) {
                const a = '' + keys[i - 1];
                const b = '' + keys[i];
                const linkByKey = new Map();
                for (const d of data) {
                    const d_a = d[a];
                    const d_b = d[b];
                    const sourceName = JSON.stringify([a, getUserName(d_a)]);
                    const targetName = JSON.stringify([b, getUserName(d_b)]);
                    if (d[a] && d[b] && nodeByKey.has(sourceName) && nodeByKey.has(targetName)) {
                        const names = [sourceName, targetName];
                        const key = JSON.stringify(names);
                        // const value = (d.value??d_a.total) || 1;
                        // const value = Math.min(d_a.total,maxLimit);
                        const value = Math.min(d_a.total, maxLimit);
                        const arr = [d.key];//just ad for testing
                        let link = linkByKey.get(key);
                        const byComp = {};
                        const byComp_t = {};
                        byComp[d.key] = value;
                        byComp_t[d.key] = Math.min(d_b.total, maxLimit);
                        // _byComp_t[d.key] = d_b.total;

                        if (link) {
                            let new_val = Math.min((link.byComp[d.key] ?? 0) + value, maxLimit);
                            let delta = new_val - (link.byComp[d.key] ?? 0);
                            link.byComp[d.key] = new_val;

                            let new_val_t = Math.min((link.byComp_t[d.key] ?? 0) + byComp_t[d.key], maxLimit);
                            link.byComp_t[d.key] = new_val_t;
                            // link._byComp_t[d.key] = (link._byComp_t[d.key]??0)+_byComp_t[d.key];

                            nodeByKey.get(sourceName).comp[d.key] = true;
                            nodeByKey.get(targetName).comp[d.key] = true;
                            d_a.jobs[0].forEach((d, i) => link.sources[d] = {display: {}, data: d_a.jobs[1][i]});
                            d_b.jobs[0].forEach((d, i) => link.targets[d] = {display: {}, data: d_b.jobs[1][i]});
                            // if a compute over the limit
                            link.value += delta;
                            d_b.forEach((n, i) => {
                                link._target[i].value += n.value;
                                link._target.total = (link._target.total ?? 0) + n.value;
                            });
                            link.arr.push(arr[0]);
                            // TIME ARC
                            // if (nodes[link.source].maxval<link.value) {
                            //     nodes[link.source].maxval = link.value;
                            //     nodes[link.source].maxIndex = i - 1;
                            // }
                            // if (nodes[link.target].maxval<link.value) {
                            //     nodes[link.target].maxval = link.value;
                            //     nodes[link.target].maxIndex = i;
                            // }
                            continue;
                        }
                        const source = JSON.stringify([a, getUserName(d_a)]);
                        nodeByKey.get(source).comp[d.key] = true;
                        const target = JSON.stringify([b, getUserName(d_b)]);
                        nodeByKey.get(target).comp[d.key] = true;
                        if (!mapOfSankey[sourceName])
                            mapOfSankey[sourceName] = JSON.parse(JSON.stringify(d[a]));
                        mapOfSankey[targetName] = JSON.parse(JSON.stringify(d[b]));
                        const _source = mapOfSankey[sourceName];
                        // _source.total=d[a].total;
                        const _target = mapOfSankey[targetName];
                        // _target.total=d[b].total;
                        // const _source = JSON.parse(JSON.stringify(d[a]));
                        // _source.total=Math.min(d_a.total,maxLimit);
                        // const _target = JSON.parse(JSON.stringify(d[b]));
                        // _target.total=Math.min(d_a.total,maxLimit);
                        const sources = {};
                        const targets = {};
                        d_a.jobs[0].forEach((d, i) => sources[d] = {display: {}, data: d_a.jobs[1][i]});
                        d_b.jobs[0].forEach((d, i) => targets[d] = {display: {}, data: d_b.jobs[1][i]});
                        link = {
                            byComp,
                            byComp_t,
                            // _byComp_t,
                            source: indexByKey.get(source),
                            sources,
                            targets,
                            _source,
                            target: indexByKey.get(target),
                            _target,
                            names,
                            arr,
                            value,
                            _id: 'link_' + key.replace(/\.|\[|\]| |"|\\|:|-|,/g, '')
                        };
                        if (getUserName(d_a) !== getUserName(d_b)) {
                            if (graphicopt.hideStable) {
                                nodeByKey.get(JSON.stringify([a, getUserName(d_a)])).relatedLinks.push(link);
                                nodeByKey.get(JSON.stringify([b, getUserName(d_b)])).relatedLinks.push(link);
                            }
                            nodeByKey.get(JSON.stringify([a, getUserName(d_a)])).shared = true;
                            nodeByKey.get(JSON.stringify([b, getUserName(d_b)])).shared = true;
                        } else {
                            link.isSameNode = true;
                        }
                        links.push(link);
                        linkByKey.set(key, link);
                    }
                }
            }

            if (graphicopt.showOverLimitUser) {
                let keepNodes = {};
                let nodeObj = {};
                nodes.forEach(d => {
                    nodeObj[d.id] = d;
                });
                links = links.filter(l => {
                    if (((l._source.total > l.arr.length * 36) || (l._target.total > l.arr.length * 36))) {
                        keepNodes[nodeObj[l.source].name] = true;
                        keepNodes[nodeObj[l.target].name] = true;
                        return true;
                    }
                    l.hide = true;
                    return false;
                });
                nodes = nodes.filter((n, index) => {
                    if (keepNodes[n.name])
                        return true;
                    else {
                        delete nodeObj[n.id];
                        // listUser[n.name] = n;
                        return false;
                    }
                });
                links = links.filter(l => nodeObj[l.source] && nodeObj[l.target] && nodeObj[nodeObj[l.source].parentNode] && nodeObj[nodeObj[l.target].parentNode])
            }
            if (graphicopt.hideStable) {
                let removeNodes = {};
                Object.entries(nodeList).forEach(n => {
                    let removeList = {};
                    if (!n.value.find(e => {
                        if (!e.relatedLinks.length) removeList[e.id] = true;
                        return e.relatedLinks.length
                    }))
                        Object.keys(removeList).forEach(k => removeNodes[k] = true);
                })

                nodes = nodes.filter((n, index) => {
                    if (!removeNodes[n.id])
                        return true;
                    else {
                        // listUser[n.name] = n;
                        return false;
                    }
                });
                // console.log(listUser)
                links = links.filter(l => !(removeNodes[l.source] || removeNodes[l.target]))
            }
            console.timeEnd('create links');
            return {nodes, links};
        })();

        // TIME ARC
        const nodeObj = {};
        nodes = graph.nodes.filter(d=>{nodeObj[d.id] = d;return d.first});
        nodes.forEach(d=>d.color=getColorScale(d))
        _links = graph.links.filter(l=>!l.isSameNode && nodeObj[l.source]&& nodeObj[l.target]).map(d =>{
            if (nodeObj[d.source].parentNode!==undefined){
                nodeObj[nodeObj[d.source].parentNode].childNodes.push(d.source);
                nodes.push(nodeObj[d.source]);
            }
            if (nodeObj[d.target].parentNode!==undefined){
                nodeObj[nodeObj[d.target].parentNode].childNodes.push(d.target);
                nodes.push(nodeObj[d.target]);
            }
            return Object.assign({}, d);
        });
        // renderSankey();
        debugger
        // TIME ARC
        const forceNode = nodes.filter(d=>d.shared)
        force = d3.forceSimulation()
            .force("charge", d3.forceManyBody().strength(-50))
            // .force("center", d3.forceCenter(graphicopt.widthG() / 2, graphicopt.heightG() / 2))
            .force('x', d3.forceX(graphicopt.widthG() / 2).strength(0.05))
            .force('y',  d3.forceY( graphicopt.heightG() / 2).strength(0.005))
            .nodes( forceNode)
            .force('link',d3.forceLink(_links).id(d=>d.id).distance(0).strength(1))
            .alpha(1)
            .on('tick',function () {
                onLoadingFunc( {percentage:(1-this.alpha())*100,text:'TimeArc calculation'});
                forceNode.forEach( (d,i) =>{
                    if(d.x!==undefined && d.y!==undefined) {
                        // d.x += ((self.widthG() / 2) - d.x) * 0.05;
                        if (d.parentNode !== undefined) {
                            if ((nodeObj[d.parentNode]!== undefined) && (nodeObj[d.parentNode].y !== undefined))
                                d.y += ((nodeObj[d.parentNode].y??0) - d.y) * 0.5;

                            if (nodeObj[d.parentNode].childNodes && nodeObj[d.parentNode].childNodes.length) {
                                nodeObj[d.parentNode].y = d3.mean(nodeObj[d.parentNode].childNodes,e=>nodeObj[e].y);
                            }
                        } else if (d.childNodes && d.childNodes.length) {
                            var yy = d3.mean(d.childNodes, e => nodeObj[e].y);
                            if (yy !== undefined)
                                d.y += (yy - d.y) * 0.2;
                        }
                    }
                });
            })
            .on("end", function () {
                onLoadingFunc();
                console.time('forceEnd');
                let left = 1;
                const nodep = {};
                forceNode.forEach(d=>{
                    if ((d.parentNode !==undefined) && nodeObj[d.parentNode].childNodes && nodeObj[d.parentNode].childNodes.length) {
                        nodep[d.name] = d3.mean(nodeObj[d.parentNode].childNodes,e=>nodeObj[e].y);
                    }else if(d.y){
                        nodep[d.name] = d.y;
                    }
                });
                Object.keys(nodep).sort((a,b)=>(nodep[a])- (nodep[b]))
                    .forEach((k,ki)=>nodep[k]= ki*10);
                // console.log(forceNode.slice().sort((a,b)=>a.y-b.y).map(d=>d.name))
                const miny =0;
                graph.nodes.forEach(d=>{
                    d._forcey =  nodep[d.name];
                    if((d._forcey === undefined) || _.isNaN(d._forcey) ) {
                        if (nodep[d.name] === undefined) {
                            nodep[d.name] = miny - 10 * (left);
                            d._forcey = nodep[d.name];
                            left++;
                        } else {
                            d._forcey = nodep[d.name];
                        }
                    }
                    d.y = d._forcey;
                });
                // graph.nodes.forEach(d=>d._forcey = d.y??nodeObj[d.parentNode].y);
                nodeSort = function(a,b){ return (a._forcey-b._forcey)};
                renderSankey();
            })

        function renderSankey(){
            let nodeObj = {};
            graph.nodes.forEach(d=>{nodeObj[d.id] = d;});
            sankey.nodeId(function(d){return d.id})
                .nodeSort(nodeSort)
                // .linkSort(function(a,b){return ((a.source._forcey+a.target._forcey)-(b.source._forcey+b.target._forcey))})
                .extent([[x.range()[0], 10], [x.range()[1], graphicopt.heightG()-10]]);

            const __nodes = graph.nodes.map(d => Object.assign({}, d))
            const __links = graph.links.map(d => Object.assign({}, d));
            const {nodes, links} = sankey({
                nodes: __nodes,
                links: __links
            });

            // const nodes = __nodes;
            // const links = __links.map(d=>({...d,source:nodes[d.source],target:nodes[d.target]}));

            console.timeEnd('Sankey cal')
            const linksBySource = d3.nest().key((d)=>d.source.name).entries(links);
            linksBySource.forEach((l)=>{
                let pre = l.values[0].source;
                let preL = l.values[0];
                l.drawP = [horizontalSource3(preL)];
                l.draw = [pre];
                l.values.forEach((d)=>{
                    if (pre!==d.source){
                        l.draw.push(pre,d.source);
                        l.drawP.push(horizontalTarget3(preL),undefined,horizontalSource3(d));
                    }else{
                        l.draw.push(d.source);
                        l.drawP.push(horizontalTarget3(preL),horizontalSource3(d));
                    }
                    pre = d.target;
                    preL = d;
                });
                l.draw.push(pre);
                l.drawP.push(horizontalTarget3(preL));
                l._class = str2class(l.key);

            });
            linksBySource.forEach(d=>{
                const start  = d.draw[0].x1;
                const endT  = _.last(d.draw);
                const end  = (endT?.x0)??0;
                const scale = d3.scaleLinear().range([0,100]).domain([start,end]);
                const fill = (colorBy!=='name')?`url(#${d.values[0]._id})`:getColorScale(d.draw[0]??{});
                const dot = [];
                if (sankeyComputeSelected && sankeyComputeSelected.nodes[d.key]){
                    d.values.forEach(l=>{
                        if (sankeyComputeSelected.nodes[d.key][l.target.layer]){
                            sankeyComputeSelected.nodes[d.key][l.target.layer].x =l.target.x0;
                            sankeyComputeSelected.nodes[d.key][l.target.layer].y =l.y1;
                            dot.push(sankeyComputeSelected.nodes[d.key][l.target.layer])
                        }
                    })
                    const color =  colorCluster?colorCluster('outlier'):'gray';
                    d.draw.dot = dot;
                    d.draw.dot.color = color;
                }else{
                    delete d.draw.dot;
                }
                d.draw.start = start;
                d.draw.end = end;
                d.draw.scale = scale;
                d.drawP.fill = fill;
            });

            links.forEach(l=>{
                if (l.isSameNode){
                    let parentNode = l.source;
                    if (l.source.parentNode!==undefined){
                        parentNode = nodeObj[l.source.parentNode];
                    }
                    if (parentNode.drawData.length===0 || parentNode.drawData[parentNode.drawData.length-1][0]!==l.source.time)
                        parentNode.drawData.push([l.source.time,l.value]);
                    parentNode.drawData.push([l.target.time,l.value]);
                }


                l._class = str2class(l.source.name)
            });
            
            graph_ = {nodes, links,linksBySource};
            console.log('#links: ',graph_.links.length);
            let isAnimate = true;
            if (links.length>400)
                isAnimate = false;
            svg_paraset = drawArea;
            let node_g = svg_paraset.select('.nodes');
            if(node_g.empty()){
                node_g = svg_paraset.append('g').classed('nodes',true);
            }
            let node_p = node_g
                .selectAll("g.outer_node")
                .data(nodes.filter(d=>d.first),d=>d.name)
                .join(
                    enter => (e=enter.append("g").attr('class','outer_node element'),e.append("title"),/*e.append("rect"),*/e.append("text"),e.attr('transform',d=>`translate(${d.x0},${d.y0})`)),
                    update => update.call(update=>(isAnimate?update.transition().duration(graphicopt.animationTime):update).attr('transform',d=>`translate(${d.x0},${d.y0})`)),
                    exit => exit.call(exit=>(isAnimate?exit.transition().duration(graphicopt.animationTime).attr('opacity',0):exit).remove()),
                );
            node_p.select('text')
                .attr("x", - 6)
                .attr("y", d => (d.y1 + d.y0) / 2-d.y0)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .attr("paint-order", "stroke")
                .attr("stroke", "white")
                .attr("stroke-width", "3")
                .attr("fill", d=>d.first?getColorScale(d):'none')
                .attr('font-weight',d=>d.isShareUser?null:'bold')
                .text(d => {
                    return d.first?d.name:''});
            node_p.each(function(d){
                d.node = d3.select(this);
            });
            link_g = svg_paraset.select('.links');
            if(link_g.empty()){
                link_g = svg_paraset.append('g').classed('links',true);
            }
            links.forEach(l=>{
                if (l.isSameNode){
                    let parentNode = l.source;
                    if (l.source.parentNode!==undefined){
                        parentNode = nodeObj[l.source.parentNode];
                    }
                    if (parentNode.drawData.length===0 || _.last(parentNode.drawData)[0]!==l.source.time)
                        parentNode.drawData.push([l.source.time,l.value]);
                    parentNode.drawData.push([l.target.time,l.value]);
                }
                l._class = str2class(l.source.name)
            });
            area.y0((d)=>d[1]+(d[2])).y1((d)=>d[1]-(d[2]));
            let link_p = link_g
                .attr("fill", "none")
                .selectAll("g.outer_node")
                .data(linksBySource,(d,i)=>d.key)
                .join(
                    enter => {
                        let e=enter.append("g").attr('class',d=>'outer_node element '+d._class)
                            .classed('hide',d=>d.hide)
                            .attr("opacity", 0.5).style("mix-blend-mode", "multiply").attr('transform','scale(1,1)');
                        // gradient
                        const gradient = e.append("linearGradient")
                            .attr("id", d => d.values[0]._id)
                            .attr("gradientUnits", "userSpaceOnUse")
                            .attr("x1", d => d.draw.start)
                            .attr("x2", d => d.draw.end);
                        gradient.selectAll("stop").data(d=>d.draw.map(e=>[d.draw.scale(e.x0),getColorScale(e)]))
                            .enter().append('stop')
                            .attr("offset", d=>`${d[0]}%`)
                            .attr("stop-color", d => d[1]);
                        // gradient ---end
                        const path = e.append("path").attr('class','main')
                            // .classed('hide',d=>d.arr===undefined)
                            .attr("stroke-width", 0.1)
                            .attr("fill", d => d.drawP.fill)
                            .attr("stroke", d => d.drawP.fill)
                            .attr("d", d=>linkPath(d.drawP)??'');
                        if (isAnimate)
                            path.attr("opacity", 0)
                            .transition().duration(graphicopt.animationTime)
                            .attr("opacity", 1);
                        path.each(function(d){d.dom=d3.select(this)});
                        e.append("title");
                        return e
                    },update => {
                        update.attr('class',d=>'outer_node element '+d._class).classed('hide',d=>d.hide);
                        // gradient
                        const gradient = update.select("linearGradient")
                            .attr("id", d => d.values[0]._id)
                            .attr("gradientUnits", "userSpaceOnUse")
                            .attr("x1", d => d.draw.start)
                            .attr("x2", d => d.draw.end);

                        gradient.selectAll("stop").data(d=>d.draw.map(e=>[d.draw.scale(e.x0),getColorScale(e)]))
                            .join('stop')
                            .attr("offset", d=>`${d[0]}%`)
                            .attr("stop-color", d => d[1]);
                        // gradient ---end
                        const path = update.select('path')
                            .attr("fill", d => d.drawP.fill)
                            .attr("stroke", d => d.drawP.fill)
                            .attr("d", d=>linkPath(d.drawP)??'');
                        if (isAnimate)
                            path
                            .transition().duration(graphicopt.animationTime)
                                .attr("d", d=>linkPath(d.drawP)??'');
                        else
                            path.attr("d", d=>linkPath(d.drawP)??'');
                        return update
                    },exit=>{
                        return exit.call(exit=>(isAnimate?exit.transition().duration(graphicopt.animationTime):exit).attr('opacity',0).remove())
                    }
                ).on("mouseover", function(d){console.log('mouse start------------');console.time('------mouse end');  mouseover.bind(this)(d); console.timeEnd('------mouse end') })
                .on("mouseout", function(d){mouseout.bind(this)(d)})
                .on("click", function(d){master.click.forEach(f=>f(d));});
            link_p.each(function(d){
                d.node = d3.select(this);
            })
            // link_p.each(function(d){
            //     const nodematch = {};
            //     const match = links.filter(l=>l.target.name===d.source.name || l.target.name===d.source.name);
            //     match.forEach(d=>{if (d.source.node) nodematch[d.source.name] = d.source.node});
            //     d.relatedNode = match
            //         .map(l=>l.node);
            //     d3.entries(nodematch).forEach(e=>d.relatedNode.push(e.value));
            // });
            link_p.select('path')
                .each(function(d){d.dom=d3.select(this)});
            // link_p.select('title').text(d => `${d.names.join(" ??? ")}\n${d.value.toLocaleString()}`);
            // link_p.select('title').text(d => `${d.names.join(" ??? ")}\n${d.arr}`);
            g.select('.background').select('.drawArea').attr('clip-path',null)
            g.select('.axisx').attr('transform',`translate(0,${graphicopt.heightG()})`).call(d3.axisBottom(x));
            onLoadingFunc();
            onFinishDraw.forEach(d=>d());}
        function horizontalSource(d) {
            return [d.source.x1, d.y0];
        }

        function horizontalTarget(d) {
            return [d.target.x0, d.y1];
        }

        function horizontalSource3(d) {
            return [d.source.x1, d.y0, d.width/2];
        }

        function horizontalTarget3(d)  {
            return [d.target.x0, d.y1, d.width/2];
        }
        function linkPath(d) {
            return area(d);
        }
        function renderFargment(source,target,width,thick,lineaScale = 0){
            thick = thick + lineaScale;
            return `M ${source[0]} ${source[1]-thick} C ${source[0]+width} ${source[1]-thick}, ${target[0]-width} ${target[1]-thick}, ${target[0]} ${target[1]-thick}
            L ${target[0]} ${target[1]+thick} C ${target[0]-width} ${target[1]+thick}, ${source[0]+width} ${source[1]+thick}, ${source[0]} ${source[1]+thick} Z`;
        }
        function getMetric (v){
            return colorBy!=='name'?((colorBy!=='cluster')?`${dimensions[selectedService].text}: ${+d3.format('.2f')(dimensions[selectedService].scale.invert(v))}`:(clusterDescription?(clusterDescription[v]??'mixed'):'')):''
        }

    };
    master.highlightPoint=(usergrouptimestep={},className='outlier')=>{
        link_g.selectAll("g.outer_node").filter(d=>usergrouptimestep[d.key]).each(function(d){
            const dot = [];
            d.values.forEach(l=>{
                if (usergrouptimestep[d.key][l.target.layer]){
                    usergrouptimestep[d.key][l.target.layer].x =l.target.x0;
                    usergrouptimestep[d.key][l.target.layer].y =l.y1;
                    dot.push(usergrouptimestep[d.key][l.target.layer])
                }
            });
            d3.select(this).selectAll('circle.'+className).data(dot).join('circle')
                .attr('class',className)
                .attr('fill','black')
                .attr('r',d=>Math.sqrt(d.length)+2)
                .attr('cx',d=>d.x)
                .attr('cy',d=>d.y)
                .attr('stroke',"white");
        })
        link_g.selectAll("g.outer_node").filter(d=>!usergrouptimestep[d.key]).selectAll('circle.'+className).remove();
    }
    function getUserName2(arr){
        if (arr && arr.length)
        {
            return arr.join(',');
        }else
            return 'No user';
    }
    function str2class(str){
        return 'l'+str.replace(/ |,/g,'_');
    }
    let getRenderFunc = function(d){
        return `M${d[0][0]} ${d[0][1]} L${d[1][0]} ${d[1][1]}`;
    };
    let getDrawData = function(){return[];}
    function freezeHandle(){
        if (isFreeze){
            const func = isFreeze;
            isFreeze = false;
            func();
        }else{
            isFreeze = true;
            isFreeze = (function(){d3.select(this).dispatch('mouseout')}).bind(this);
            if (d3.event.stopPropagation) d3.event.stopPropagation();
        }
    }
    function freezeHandleTrigger(value){
        if (value){
            isFreeze = ()=>{};
        }else{
            isFreeze = false;
        }
    }
    function getUserName(arr){
        if (arr && arr.length)
        {
            if (arr.length===1)
                return 'User '+arr[0].key.replace('user','');
            else
                return arr.map(d=>d.key.replace('user','')).join(',');
        }else
            return 'No user';
    }
    function compressName(arr){
        let limit = 5;
        const arrn = arr.map(e=>e.replace('10.101.', ''));
        return (arrn.length>limit?[...arrn.slice(0,limit),'+ '+(arrn.length-limit)+'nodes']:arrn).join(', ')
    }
    master.getUserName2 = getUserName2;
    master.loadingFunc = function(_){onLoadingFunc = _;return master;};
    master.freezeHandle = freezeHandle;
    master.freezeHandleTrigger = freezeHandleTrigger;
    master.main_svg = function(){return main_svg};
    master.resetZoom = function (){
        let startZoom = d3.zoomIdentity;
        startZoom.x = graphicopt.margin.left;
        startZoom.y = graphicopt.margin.top;
        g.call(graphicopt.zoom.transform, d3.zoomIdentity);
    };
    function zoomed(){
        g.attr("transform", d3.event.transform);
    }
    master.toggleZoom = function (isZoom){
        if (isZoom){
            d3.select(maindiv)
                .call(graphicopt.zoom.on("zoom", zoomed))
        }else{
            master.resetZoom();
            d3.select(maindiv)
                .on('.zoom', null);
        }
    };
    master.init=function(){
        // graphicopt.width = d3.select(maindiv).node().getBoundingClientRect().width;
        // graphicopt.height = d3.select(maindiv).node().getBoundingClientRect().height;
        r = d3.min([graphicopt.width, graphicopt.height]) / 2-20 ;
        main_svg = d3.select(maindiv)
            .attr("width", graphicopt.width)
            .attr("height", graphicopt.height)
            .style('overflow','visible');
        if(main_svg.select('#timeClip').empty())
            main_svg.append('defs').append('clipPath').attr('id','timeClip')
                .append('rect').attr('x',-graphicopt.margin.left).attr('width',graphicopt.margin.left).attr('height',graphicopt.heightG());
        g = main_svg
            .select("g.content");

        if (g.empty()){
            g = d3.select(maindiv)
                .call(graphicopt.zoom.on("zoom", zoomed))
                .attr("width", graphicopt.width)
                .attr("height", graphicopt.height)
                .append("g")
                .attr('class','content')
                // .attr("transform", "translate(" + (graphicopt.margin.left+graphicopt.diameter()/2) + "," + graphicopt.centerY() + ")")
                .on('click',()=>{if (isFreeze){
                    const func = isFreeze;
                    isFreeze = false;
                    func();
                }});
            g.append('g').attr('class','background').style('opacity',0.2);
            g.append('g').attr('class','drawArea');
            let axis = g.append('g').attr('class','axis');
            axisx = axis.append('g').attr('class','axisx');
            axisy = axis.append('g').attr('class','axisy');
            g.call(tooltip);
            let startZoom = d3.zoomIdentity;
            startZoom.x = graphicopt.margin.left;
            startZoom.y = graphicopt.margin.top;
            g.call(graphicopt.zoom.transform, d3.zoomIdentity);
            g.append('defs');
            g.append('g').attr('class','timeHandleHolder')
                .append('line').attr('class','timeStick')
                .attr('y2',graphicopt.heightG())
                .style('stroke','black')
                .attr('stroke-dasharray','2 1');
        }
        return master
    };
    master.padding = function(_data) {
        return arguments.length?(graphicopt.padding=_data,master):graphicopt.padding;
    };
    master.data = function(_data) {
        return arguments.length?(data=_data,master):data;
    };
    master.times = function(_data) {
        return arguments.length?(times=_data,master):times;
    };
    master.color = function(_data) {
        return arguments.length?(colorByName=_data,master):colorByName;
    };
    master.colorCluster = function(_data) {
        return arguments.length?(colorCluster=_data,master):colorCluster;
    };
    master.getColorScale = function(_data) {
        return arguments.length?(getColorScale=_data?_data:function(){return color},master):getColorScale;
    };
    master.graphicopt = function(_data) {
        if (arguments.length){
            d3.keys(_data).forEach(k=>graphicopt[k]=_data[k]);
            return master;
        }else
            return graphicopt;
    };
    master.sankeyOpt = function(_data){
        if (arguments.length) {
            if (_data.nodeSort!==undefined) {
                switch (_data.nodeSort) {
                    case '':
                        nodeSort = undefined;
                        break;
                    case 'size':
                        nodeSort = function (a, b) {
                            return a.value - b.value
                        };
                        break;
                }
            }
            d3.keys(_data).forEach(k => graphicopt[k] = _data[k]);
            return master;
        }else
            return graphicopt
    }
    master.getRenderFunc = function(_data) {
        return arguments.length?(getRenderFunc=_data,master):getRenderFunc;
    };
    master.graph = function() {
        return {nodes,links:_links};
    };
    master.getDrawData = function(_data) {
        return arguments.length?(getDrawData=_data,master):getDrawData;
    };
    master.onFinishDraw = function(_data) {
        onFinishDraw.push(_data)
        return master;
    };

    master.g = function(){return g};
    master.isFreeze = function(){return isFreeze};
//     function mouseover(d){
//         console.time('mouseover')
//         if (!isFreeze) {     // Bring to front
//             console.time('calculate related node!')
//             // if (!d.relatedNode){
//             //     const nodematch = {};
//             //     const match = graph_.links.filter(l=>l.target.name===d.source.name || l.target.name===d.source.name);
//             //     match.forEach(d=>{if (d.source.node) nodematch[d.source.name] = d.source.node});
//             //     // d.relatedNode = match
//             //     //     .map(l=>l.node);
//             //     d.relatedNode = match.map(l=>l.source.node);
//             // }
//             //
//             // d.relatedNode.forEach(e=>{if (e) e.classed('highlightText', true)});
//             console.timeEnd('calculate related node!')
//             g.selectAll('.'+d._class).style('opacity',1);
//             master.mouseover.forEach(f=>f(d));
//             // master.updateTimeHandle(d.source.time)
//         }else{
//             g.classed('onhighlight2', true);
//             d3.select(this).classed('highlight2', true);
//             if (d.node) {
//                 d.node.classed('highlight2', true);
//             }
//             d.relatedNode.forEach(e=>e.classed('highlight2', true));
//         }
//         const timeformat = d3.timeFormat('%m/%d/%Y %H:%M');
//         tooltip.show(`<h5>10.101.${compressName(d.arr)}</h5><div class="container"><div class="row"><table class="col-5"><tbody>
// <tr><th colspan="2">${timeformat(d.source.time)}</th></tr>${d._source.map(e=>`<tr><th>${e.key}</th><td>${e.value}</td></tr>`).join('')}</tbody></table>
// <div class="col-2">-></div><table class="col-5"><tbody><tr><th colspan="2">${timeformat(d.target.time)}</th></tr>${d._target.map(e=>`<tr><th>${e.key}</th><td>${e.value}</td></tr>`).join('')}</tbody></table></div></div>`);
//         console.timeEnd('mouseover')
//     }
    function mouseover(d){
        console.time('mouseover')
        g.selectAll('.'+d._class).style('opacity',1);
        master.mouseover.forEach(f=>f(d));
        let timeformat = d3.timeFormat('%m/%d/%Y %H:%M');
        tooltip.show(`<h5>10.101.${compressName(d.arr)}</h5><div class="container"><div class="row"><table class="col-5"><tbody>
        <tr><th colspan="2">${timeformat(d.source.time)}</th></tr>${d._source.map(e=>`<tr><th>${e.key}</th><td>${e.value}</td></tr>`).join('')}</tbody></table>
        <div class="col-2">-></div><table class="col-5"><tbody><tr><th colspan="2">${timeformat(d.target.time)}</th></tr>${d._target.map(e=>`<tr><th>${e.key}</th><td>${e.value}</td></tr>`).join('')}</tbody></table></div></div>`);
        console.timeEnd('mouseover')
    }
    let filterKey=[];
    master.highlight = function(listKey){
        filterKey = listKey
        let listobj = {};
        listKey.forEach(k=>listobj[k]=true);

        g.selectAll('.'+filterKey.map(k=>str2class(getUserName([{key:k}]))).join(',.')).style('opacity',1);
    };
    master.releasehighlight = function(){
        g.selectAll('.'+filterKey.map(k=>str2class(getUserName([{key:k}]))).join(',.')).style('opacity',null);
    };
    master.highlight2 = function(listKey){
        g.classed('onhighlight2', true);
        g.selectAll('.element').filter(d=>listKey.find(e=>d&&(e===d.key)))
            .classed('highlight2', true);
    };
    master.releasehighlight2 = function(){
        g.classed('onhighlight2', false);
        g.selectAll('.element.highlight2')
            .classed('highlight2', false);
    };
    master.metrics = function(_){
        metrics = _;
    }
    function mouseout(d){
        if(!isFreeze)
        {
            // d.relatedNode.forEach(e=>{if (e) e.classed('highlightText', false)});
            g.selectAll('.'+d._class).style('opacity',null);
            master.mouseout.forEach(f=>f(d));
            // master.updateTimeHandle()
        }else{
            g.classed('onhighlight2', false);
            d3.select(this).classed('highlight2', false);
            if (d.node) {
                d.node.classed('highlight2', false);
            }
            d.relatedNode.forEach(e=>e.classed('highlight2', false));
        }
        tooltip.hide()

    }

    return master;
};
