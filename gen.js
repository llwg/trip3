#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write

/// ./gen.js <(pandoc --from markdown+lists_without_preceding_blankline --to json trip.md)

// deno add jsr:@std/io
import { writeAll } from "@std/io/write-all";
import { existsSync } from "https://deno.land/std@0.224.0/fs/exists.ts";

Array.prototype.to_h = function() { return Object.fromEntries(this) }
Object.prototype.to_a = function() { return Object.entries(this) }
Array.prototype.last = function() { return this[this.length - 1] }

const [jsonpath] = Deno.args
if (!jsonpath) throw `Args: <json path>`

const j = JSON.parse(await Deno.readTextFile(jsonpath))

const i2text = inline => {
	const handlers =
		{ Str: ({ c }) => c
		, Space: _ => ' '
		}
	if (!handlers[inline.t]) throw `unsupported inline: ${JSON.stringify(inline)}`
	return handlers[inline.t](inline)
}
const is2text = is => is.map(i2text).join('')

const text2id = text => text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-')

/***** */
const ri = html => ({ t: 'RawInline', c: ['html', html] })
const str = str => ({ t: 'Str', c: str })

const CONVERT_MAP =
	{ jpg: "webp"
	, png: "webp"
	, mp4: "webm"
	}
const CONVERT_PLZ = path => {
	const [,name, ext] = path.match(/\/([\w-]+)\.(\w+)$/)
	const output = `media/${name}.${CONVERT_MAP[ext]}`

	if (existsSync(output)) {
		console.error(`${output} already exists`)
		return output
	} else {
		console.error("CONVERT")
		if (ext === 'mp4') {
			const cmd = new Deno.Command("ffmpeg", { args: ["-i", path, output] })
			console.error(cmd.outputSync())
		} else {

			const cmd = new Deno.Command("convert", { args: [path, "-auto-orient", output] })
			console.error(cmd.outputSync())
		}
		return output
	}
}

const handlers = {
	Link: ({ tree: { c }, currHead }) => {
		const [_, [...basething], [explain]] = c
		return { needFlat: true, currHead, tree: [ ri('<ruby>'), ...basething, ri('<rt>'), str(decodeURIComponent(explain)), ri('</rt>'), ri('</ruby>') ]}
	}

	, Str: ({ tree, currHead }) => tree.c === '->'
		? ({ tree: str('→'), currHead })
		: ({ tree, currHead })

	, Header: ({ tree, currHead }) => {
		const level = tree.c[0] // :)
		const id = tree.c[1][0]

		if (level == 2) return { tree, currHead: id }
		else return { tree, currHead }
	}
	, Image: ({ currHead, tree }) => {
		const { t, c: [a, b, [_href, y]]} = tree

		const filename = _href.startsWith('misc')
			? _href
			: `../temp-trip3-dated-fotos/${_href}`

		// console.error(b)
		console.error(_href)

		console.error(Deno.statSync(filename).mtime)



		// const updated_caption = [str(`${time(curr_timezone)(Deno.statSync(filename).mtime)}: `), ...b]

		// return {tree, currHead}
		return { tree: {t, c: [a, b, [CONVERT_PLZ(filename), y]]}, currHead }
	}
}

// honeslty not sure what currHead and stuff is for (I forget)
const hehe = x => {

	let { tree, currHead } = x

	if (typeof(tree) !== 'object') {
		return { tree, currHead }
	}

	if (Array.isArray(tree)) {
		const res = []
		for (const t of tree) {
			const { tree: tres, needFlat, currHead: newhead } = hehe({ tree: t, currHead })
			currHead = newhead
			if (needFlat)
				res.push(...tres)
			else
				res.push(tres)
		}
		return { tree: res, currHead }
	}

	// console.error(tree)

	const { t, c } = tree

	let recurse = null

	if (c) {
		const { tree: res, currHead: resHead } = hehe({ tree: c, currHead })
		recurse =  { tree: { t, c: res }, currHead: resHead }
	} else {
		recurse =  { tree, currHead }
	}

	const h = handlers[t]
	return h ? h(recurse) : recurse
}


/******** */

// [[block]]
const _pages = []

for (const block of j.blocks) {
	if (block.t === 'Header' && block.c[0] === 1) { // h1
		const [level, attr, is] = block.c
		const title = is2text(is)
		const id = text2id(title)
		_pages.push({ title, id, blocks: [block] })
	} else {
		_pages.last().blocks.push(block)
	}
}

// const pages = await Promise.all(_pages.map(async block => {
// 	const page = {}
// }))

// j.blocks = hehe({ tree: j.blocks, currHead: 'hehehh' }).tree

// console.log(hehe({ tree: j.blocks, currHead: 'hehehh' }).tree)

const pandoc_blocks2html = async ({ blocks, "pandoc-api-version": api_ver, meta }) => {
	const p = Deno.run({ cmd: ['pandoc', '--from', 'json', '--to', 'html'], stdout: 'piped', stdin: 'piped' })
	await writeAll(p.stdin, new TextEncoder().encode(JSON.stringify({ blocks, "pandoc-api-version": api_ver, meta })))
	await p.stdin.close()
	const out = await p.output()
	p.close();
	return new TextDecoder().decode(out)
}

for (const { blocks, id, title } of _pages) {
	const html_content = await pandoc_blocks2html({
		blocks: hehe({ tree: blocks, currHead: 'hehehh' }).tree,
		"pandoc-api-version": j['pandoc-api-version'],
		meta: j.meta
	})

	await Deno.writeTextFile(`${id}.html`, `<!DOCTYPE html>
<link rel=stylesheet href=style.css>
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes" />
<body><div class=breadcrumb>You Browse: <a href="./index.html">top</a> / <a href="./${id}.html">${title}</a></div>${html_content}</body>
`)
}

await Deno.writeTextFile(`index.html`, `<!DOCTYPE html>
	<link rel=stylesheet href=style.css>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes" />

	<body>
	<h1>trip3</h1>
	<p>
	welcome to trip3. you can browse the following pages:
	<ul>
		${_pages.map(({ title, id }) => `<li><a href='./${id}.html'>${title}</a></li>`).join('')}
	</ul>
	</p>
	</body>

`)
