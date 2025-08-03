<script lang="ts">
  export let title: string;
  export let image: string;
  export let link: string;
</script>

<a href={link} target="_blank" class="block bg-white rounded-lg shadow-md overflow-hidden transition-transform duration-300 hover:scale-105 hover:shadow-xl">
  <img src={image} alt={title} class="w-full aspect-[3/2] object-cover" />
  <div class="p-4">
    <h2 class="text-sm text-gray-800">{title}</h2>
  </div>
</a>