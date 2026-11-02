
## gemma 

- gemma3:4b 
	- 3.4gb 
	- 128k context window 
	- won't easily overflow or forget info when reading dense doc results
	- complex doc structures, larger text context, processing inline images/charts 
- __gemma2:2b__ 
	- 1.6gb 
	- 8k context window 
	- text only 
	- req. smaller document chunk sizes (4-500 tk/chunk) 
	- would only retrieve top 3-4 most relevant paragraphs to avoid running out of space 
	- fast text-only lookups on lower spec hardware/computers with contrained RAM 
