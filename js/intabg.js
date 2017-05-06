//Fix  Gmail Embed image
if(location.host=='mail.google.com'){
	myInterval=function(){
		try{
			loadjQuery();
			if ($('[contenteditable]').html().indexOf('https://www.openscreenshot.com/img/')>=0) {
				$('[contenteditable]').html($('[contenteditable]').html().replace(/http:\/\/www\.userstory\.in\(.*) Captured by http:www.userstory/,'<a href="http://www.userstory.in/"><img height=100px '));
				window.clearInterval(myInt);
			}
		}
	catch(e){}
	}

	if(document.location.href.indexOf('openscreenshot')>=0)
		myInt=window.setInterval(myInterval,50);
}

	if(location.host=='www.blogger.com')
		if (location.hash.slice(0,4)=='#ws='){
			loadjQuery();
			$(function(){
				var image= decodeURIComponent (location.hash.slice(4))
				var url=image.replace('i3','img')
				$('body',$('#postingComposeBox')[0].contentDocument).html('<a href=' +  url + '><img src=' + image +  '></a><br>Taken With <a href=https://www.openscreenshot.com>Open Screenshot></a><br>')
			})
		}
